import {
  pgTable, serial, varchar, text, integer, boolean, timestamp, date, time,
  decimal, primaryKey, index, uniqueIndex, jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Departments ─────────────────────────────────────────────────────────────
// 3 vestigingen: bb / sl / kl. Slug komt overeen met de URL.
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 8 }).notNull().unique(),
  naam: varchar("naam", { length: 100 }).notNull(),
  hex: varchar("hex", { length: 7 }).notNull(),
  // Werkgeverslasten als opslag bovenop bruto loon (pensioen + AOF + WW + ZVW
  // + opleidingsfonds + sociaal fonds). Default 27,00% horeca-typisch; eigenaar
  // kan finetunen na een paar loonjournaal-cycli. Wordt gebruikt in:
  //   - Loonkost-ratio in MaandPnL
  //   - Inleen-doorberekening (toggle "Met werkgeverslasten")
  //   - Salaris-detail (totale arbeidskost per medewerker)
  werkgeverslastenPct: decimal("werkgeverslasten_pct", { precision: 5, scale: 2 }).default("27.00"),
  // Huidig bank-saldo (handmatig bijgehouden door owner). Bron voor de
  // cashflow-projectie — vanaf hier rekenen we vooruit. Owner werkt 'm bij
  // na elke ING-upload of wanneer 'ie weet wat het saldo nu is.
  huidigSaldo:           decimal("huidig_saldo",           { precision: 12, scale: 2 }),
  huidigSaldoOpgeslagen: timestamp("huidig_saldo_opgeslagen", { withTimezone: true }),
  // Voor migratie van Shiftbase
  shiftbaseDepartmentId: varchar("shiftbase_department_id", { length: 32 }),
  shiftbaseTeamId:       varchar("shiftbase_team_id",       { length: 32 }),
  // Review-deeplinks per platform — owner vult in via /[bedrijf]/instellingen.
  // Voorbeelden:
  //   googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ..."
  //   tripadvisorReviewUrl: "https://www.tripadvisor.com/UserReviewEdit-g188590-d..."
  googleReviewUrl:      text("google_review_url"),
  tripadvisorReviewUrl: text("tripadvisor_review_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Medewerkers ─────────────────────────────────────────────────────────────
export const medewerkers = pgTable("medewerkers", {
  id: serial("id").primaryKey(),

  voornaam:   varchar("voornaam",   { length: 80 }).notNull(),
  achternaam: varchar("achternaam", { length: 80 }).notNull(),
  email:      varchar("email",      { length: 200 }).notNull().unique(),
  telefoon:   varchar("telefoon",   { length: 32 }),
  startdatum: date("startdatum"),
  einddatum:  date("einddatum"),   // null = actief

  // Salaris-basis (alles wordt per uur uitbetaald, vakantiegeld + vakantie-uren erbovenop)
  uurloon:           decimal("uurloon",            { precision: 6, scale: 2 }),
  vakantiegeldPct:   decimal("vakantiegeld_pct",   { precision: 4, scale: 2 }).default("8.33"),
  vakantieUrenPct:   decimal("vakantie_uren_pct",  { precision: 4, scale: 2 }).default("8.00"),

  // Authenticatie
  pinHash:                text("pin_hash"),                    // bcrypt hash van zelfgekozen PIN
  wachtwoordHash:         text("wachtwoord_hash"),             // bcrypt hash van wachtwoord (account-recovery / setup)
  registratieToken:       varchar("registratie_token", { length: 64 }),
  registratieVerloopt:    timestamp("registratie_verloopt", { withTimezone: true }),
  laatsteLogin:           timestamp("laatste_login",        { withTimezone: true }),
  // Bulk-geseede accounts krijgen pin_hash = bcrypt("1234") en deze vlag op true.
  // Na login wordt de medewerker dwingend naar /m/pin-resetten gestuurd; de
  // vlag wordt gewist zodra een eigen PIN gekozen is.
  moetPinResetten:        boolean("moet_pin_resetten").notNull().default(false),

  avatarUrl: text("avatar_url"),
  actief:    boolean("actief").notNull().default(true),

  // ─── NAW + loonadministratie (zelf in te vullen door medewerker) ───────
  geboortedatum: date("geboortedatum"),
  straat:        varchar("straat",       { length: 120 }),
  huisnummer:    varchar("huisnummer",   { length: 16 }),
  postcode:      varchar("postcode",     { length: 12 }),
  woonplaats:    varchar("woonplaats",   { length: 100 }),
  iban:          varchar("iban",         { length: 34 }),
  // BSN is bijzondere persoonsgegevens — server-side AES-256-GCM encrypted
  // opgeslagen. Format: <iv-hex>:<authtag-hex>:<ciphertext-hex>.
  bsnVersleuteld: text("bsn_versleuteld"),
  onboardingVoltooid: boolean("onboarding_voltooid").notNull().default(false),
  // Pas na goedkeuring door owner krijgt de medewerker toegang tot rooster,
  // uren, beschikbaarheid etc. Voor die tijd staat 'ie op een wacht-scherm.
  // Owner zet dit op true vanuit MedewerkerDocumentenPanel zodra ID + IBAN
  // gecheckt zijn.
  goedgekeurd: boolean("goedgekeurd").notNull().default(false),
  goedgekeurdOp: timestamp("goedgekeurd_op", { withTimezone: true }),
  goedgekeurdDoor: varchar("goedgekeurd_door", { length: 80 }),

  // Thuis-vestiging — gebruikt voor doorbereken-overzicht inleen-uren.
  // Werk bij een andere vestiging telt als "uitgeleend" en wordt aan het
  // einde van de maand inzichtelijk gemaakt (BB → SL: €X aan uren).
  // null = nog niet gezet; in dat geval valt logica terug op de eerste
  // koppeling in medewerker_departments.
  hoofdDepartmentId: integer("hoofd_department_id").references(() => departments.id, { onDelete: "set null" }),

  // Voor migratie
  shiftbaseUserId: varchar("shiftbase_user_id", { length: 32 }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  emailIdx: uniqueIndex("medewerkers_email_idx").on(t.email),
  shiftbaseIdx: index("medewerkers_shiftbase_idx").on(t.shiftbaseUserId),
}));

// ─── Medewerker × Department (many-to-many) ──────────────────────────────────
export const medewerkerDepartments = pgTable("medewerker_departments", {
  medewerkerId: integer("medewerker_id").notNull().references(() => medewerkers.id, { onDelete: "cascade" }),
  departmentId: integer("department_id").notNull().references(() => departments.id, { onDelete: "cascade" }),
}, (t) => ({
  pk: primaryKey({ columns: [t.medewerkerId, t.departmentId] }),
}));

// ─── Shift templates (bv. "Ochtend 09:30–16:00") ─────────────────────────────
export const shiftTemplates = pgTable("shift_templates", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").notNull().references(() => departments.id, { onDelete: "cascade" }),
  korteNaam: varchar("korte_naam",  { length: 20 }).notNull(),
  langeNaam: varchar("lange_naam",  { length: 80 }).notNull(),
  start:     time("start").notNull(),
  eind:      time("eind").notNull(),
  pauzeMin:  integer("pauze_min").notNull().default(0),
  kleur:     varchar("kleur", { length: 7 }).notNull().default("#0A84FF"),
  verwijderd: boolean("verwijderd").notNull().default(false),
  // Migratie
  shiftbaseShiftId: varchar("shiftbase_shift_id", { length: 32 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  deptIdx: index("shift_templates_dept_idx").on(t.departmentId),
}));

// ─── Rosters (geplande diensten) ─────────────────────────────────────────────
export const rosters = pgTable("rosters", {
  id: serial("id").primaryKey(),
  medewerkerId: integer("medewerker_id").notNull().references(() => medewerkers.id, { onDelete: "cascade" }),
  departmentId: integer("department_id").notNull().references(() => departments.id, { onDelete: "cascade" }),
  shiftTemplateId: integer("shift_template_id").references(() => shiftTemplates.id, { onDelete: "set null" }),

  datum:    date("datum").notNull(),
  start:    time("start").notNull(),
  eind:     time("eind").notNull(),
  pauzeMin: integer("pauze_min").notNull().default(0),
  notitie:  text("notitie"),
  gepubliceerd: boolean("gepubliceerd").notNull().default(false),

  // Migratie
  shiftbaseRosterId: varchar("shiftbase_roster_id", { length: 32 }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: integer("created_by").references(() => medewerkers.id, { onDelete: "set null" }),
}, (t) => ({
  datumIdx:    index("rosters_datum_idx").on(t.datum),
  deptDatumIdx: index("rosters_dept_datum_idx").on(t.departmentId, t.datum),
  medewerkerIdx: index("rosters_medewerker_idx").on(t.medewerkerId, t.datum),
}));

// ─── Beschikbaarheid ─────────────────────────────────────────────────────────
export const beschikbaarheid = pgTable("beschikbaarheid", {
  id: serial("id").primaryKey(),
  medewerkerId: integer("medewerker_id").notNull().references(() => medewerkers.id, { onDelete: "cascade" }),
  datum: date("datum").notNull(),
  status: varchar("status", { length: 12 }).notNull(), // 'vrij' | 'beperkt' | 'niet'
  start: time("start"),
  eind:  time("eind"),
  reden: text("reden"),
  // Migratie
  shiftbaseId: varchar("shiftbase_id", { length: 32 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uq: uniqueIndex("beschikbaarheid_medewerker_datum_uq").on(t.medewerkerId, t.datum),
  datumIdx: index("beschikbaarheid_datum_idx").on(t.datum),
}));

// ─── Klok-events (in/uit klokken) ────────────────────────────────────────────
export const klokEvents = pgTable("klok_events", {
  id: serial("id").primaryKey(),
  medewerkerId: integer("medewerker_id").notNull().references(() => medewerkers.id, { onDelete: "cascade" }),
  rosterId:     integer("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  type: varchar("type", { length: 8 }).notNull(), // 'in' | 'out'
  tijdstempel: timestamp("tijdstempel", { withTimezone: true }).notNull(),
  latitude:  decimal("latitude",  { precision: 9, scale: 6 }),
  longitude: decimal("longitude", { precision: 9, scale: 6 }),
  notitie: text("notitie"),
  // Door manager handmatig aangepast?
  handmatig:  boolean("handmatig").notNull().default(false),
  gewijzigdDoor: integer("gewijzigd_door").references(() => medewerkers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  medewerkerIdx: index("klok_events_medewerker_idx").on(t.medewerkerId, t.tijdstempel),
  rosterIdx:     index("klok_events_roster_idx").on(t.rosterId),
}));

// ─── Salaris-perioden ────────────────────────────────────────────────────────
// Per medewerker per maand één record met de berekende uren + bedragen.
// Status-flow: 'open' (live, kan veranderen door rooster-wijzigingen) →
// 'afgerekend' (maand is gesloten, hash bevriest de waarden) →
// 'uitbetaald' (bankoverschrijving gedaan).
//
// Het hash-veld is een SHA-256 over alle relevante velden, zodat we later
// kunnen detecteren of een afgerekend bedrag is bijgewerkt zonder dat we
// dat zien (integrity-check).
export const salarisPerioden = pgTable("salaris_perioden", {
  id: serial("id").primaryKey(),
  medewerkerId: integer("medewerker_id").notNull().references(() => medewerkers.id, { onDelete: "cascade" }),
  jaar: integer("jaar").notNull(),       // bv. 2026
  maand: integer("maand").notNull(),     // 1..12

  // Berekening
  brutoUren: decimal("bruto_uren", { precision: 7, scale: 2 }).notNull(),
  uurloon:   decimal("uurloon",    { precision: 6, scale: 2 }).notNull(),
  brutoLoon: decimal("bruto_loon", { precision: 9, scale: 2 }).notNull(),

  // Vakantiegeld (8.33%) en vakantie-uren (8%) erbovenop direct uitbetaald
  vakantiegeldPct: decimal("vakantiegeld_pct", { precision: 5, scale: 3 }).notNull(),
  vakantiegeldEur: decimal("vakantiegeld_eur", { precision: 9, scale: 2 }).notNull(),
  vakantieUrenPct: decimal("vakantie_uren_pct", { precision: 5, scale: 3 }).notNull(),
  vakantieUrenEur: decimal("vakantie_uren_eur", { precision: 9, scale: 2 }).notNull(),

  // Eindbedrag
  totaalEur: decimal("totaal_eur", { precision: 9, scale: 2 }).notNull(),

  // Bron-uren: 'klok' (uit klok_events) of 'rooster' (uit rosters) of 'mix'.
  // Bij oude historie uit Shiftbase hebben we geen klok-events → fallback rooster.
  bron: varchar("bron", { length: 16 }).notNull().default("rooster"),

  // Integrity-check
  berekenHash: varchar("bereken_hash", { length: 64 }).notNull(),

  // Status-flow
  status: varchar("status", { length: 16 }).notNull().default("open"),
  afgerekendOp: timestamp("afgerekend_op", { withTimezone: true }),
  afgerekendDoor: integer("afgerekend_door").references(() => medewerkers.id, { onDelete: "set null" }),
  uitbetaaldOp: timestamp("uitbetaald_op", { withTimezone: true }),
  betalingReferentie: varchar("betaling_referentie", { length: 64 }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uq: uniqueIndex("salaris_periode_uq").on(t.medewerkerId, t.jaar, t.maand),
  jaarMaandIdx: index("salaris_periode_jaar_maand_idx").on(t.jaar, t.maand),
}));

// ─── Audit-log ───────────────────────────────────────────────────────────────
// Onveranderlijke log van elke wijziging aan kritieke entiteiten (rosters,
// klok_events). Doel: nooit uren-data verliezen — bij elke create/update/delete
// schrijven we een record met oude + nieuwe waarde. Daarmee kan een manager
// ALTIJD reconstrueren wat er is gebeurd en wie ervoor verantwoordelijk is.
//
// Deze tabel wordt NOOIT bewerkt of verwijderd door application code.
// Alleen append-only inserts via de audit-helpers in lib/audit.ts.
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  // Welke tabel/entiteit
  entiteit: varchar("entiteit", { length: 32 }).notNull(), // 'roster' | 'klok_event' | 'medewerker' | ...
  entiteitId: integer("entiteit_id").notNull(),
  // Welke actie
  actie: varchar("actie", { length: 16 }).notNull(),        // 'create' | 'update' | 'delete'
  // Wie deed het (kan null zijn voor systeem/cron)
  doorMedewerkerId: integer("door_medewerker_id").references(() => medewerkers.id, { onDelete: "set null" }),
  doorRol: varchar("door_rol", { length: 12 }),             // 'owner' | 'manager' | 'medewerker' | 'systeem'
  // De data — JSON snapshot van velden vóór + ná de wijziging
  oudeWaarde: text("oude_waarde"),   // JSON string of null (bij create)
  nieuweWaarde: text("nieuwe_waarde"), // JSON string of null (bij delete)
  reden: text("reden"),               // optionele toelichting (manager kan invullen)
  // Audit-context
  ipAdres: varchar("ip_adres", { length: 64 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  entiteitIdx: index("audit_log_entiteit_idx").on(t.entiteit, t.entiteitId),
  doorIdx:     index("audit_log_door_idx").on(t.doorMedewerkerId, t.createdAt),
  tijdIdx:     index("audit_log_tijd_idx").on(t.createdAt),
}));

// ─── Medewerker documenten (ID, paspoort, bankpas) ──────────────────────────
// Foto's worden server-side AES-256-GCM versleuteld voordat ze naar Postgres
// gaan. iv en authtag worden bij de blob bewaard zodat decrypt mogelijk is.
// Alleen owners kunnen ze openen — endpoint check huidigeAdminSessie().
export const medewerkerDocumenten = pgTable("medewerker_documenten", {
  id: serial("id").primaryKey(),
  medewerkerId: integer("medewerker_id").notNull().references(() => medewerkers.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 32 }).notNull(), // 'id-voor' | 'id-achter' | 'paspoort' | 'bankpas'
  mimetype: varchar("mimetype", { length: 64 }).notNull(),
  bestandsnaam: varchar("bestandsnaam", { length: 200 }),
  // Versleutelde inhoud + bijbehorende crypto-velden (zie lib/documenten.ts)
  iv:           text("iv").notNull(),
  authtag:      text("authtag").notNull(),
  ciphertext:   text("ciphertext").notNull(), // base64
  grootteBytes: integer("grootte_bytes").notNull(),
  geuploadOp:   timestamp("geupload_op", { withTimezone: true }).notNull().defaultNow(),
  goedgekeurd:  boolean("goedgekeurd").notNull().default(false),
  goedgekeurdDoor: varchar("goedgekeurd_door", { length: 80 }),
  goedgekeurdOp:   timestamp("goedgekeurd_op", { withTimezone: true }),
}, (t) => ({
  medewerkerIdx: index("medewerker_documenten_medewerker_idx").on(t.medewerkerId),
}));

// ─── Sessies (cookie-tokens voor login) ──────────────────────────────────────
export const sessies = pgTable("sessies", {
  token:        varchar("token", { length: 64 }).primaryKey(),
  medewerkerId: integer("medewerker_id").notNull().references(() => medewerkers.id, { onDelete: "cascade" }),
  rol:          varchar("rol", { length: 12 }).notNull(), // 'owner' | 'manager' | 'medewerker'
  vestiging:    varchar("vestiging", { length: 8 }),       // alleen relevant voor manager
  ipAdres:      varchar("ip_adres", { length: 64 }),
  userAgent:    text("user_agent"),
  verloopt:     timestamp("verloopt", { withTimezone: true }).notNull(),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  medewerkerIdx: index("sessies_medewerker_idx").on(t.medewerkerId),
  verlooptIdx:   index("sessies_verloopt_idx").on(t.verloopt),
}));

// ─── Relaties (voor Drizzle joins) ───────────────────────────────────────────
export const medewerkersRelations = relations(medewerkers, ({ many }) => ({
  rosters: many(rosters),
  beschikbaarheid: many(beschikbaarheid),
  klokEvents: many(klokEvents),
  departments: many(medewerkerDepartments),
}));

export const departmentsRelations = relations(departments, ({ many }) => ({
  rosters: many(rosters),
  shiftTemplates: many(shiftTemplates),
  medewerkers: many(medewerkerDepartments),
}));

export const rostersRelations = relations(rosters, ({ one, many }) => ({
  medewerker: one(medewerkers, { fields: [rosters.medewerkerId], references: [medewerkers.id] }),
  department: one(departments, { fields: [rosters.departmentId], references: [departments.id] }),
  shiftTemplate: one(shiftTemplates, { fields: [rosters.shiftTemplateId], references: [shiftTemplates.id] }),
  klokEvents: many(klokEvents),
}));

export const medewerkerDepartmentsRelations = relations(medewerkerDepartments, ({ one }) => ({
  medewerker: one(medewerkers, { fields: [medewerkerDepartments.medewerkerId], references: [medewerkers.id] }),
  department: one(departments, { fields: [medewerkerDepartments.departmentId], references: [departments.id] }),
}));

// ─── SumUp transacties (gesynchroniseerde cache) ─────────────────────────────
// Elke 5 min wordt deze tabel bijgewerkt met nieuwe transacties uit SumUp,
// zodat het dashboard niet meer live de paginated API hoeft aan te roepen.

export const sumupTransacties = pgTable("sumup_transacties", {
  // sumup transaction_code is uniek per bedrijf, dus we gebruiken (bedrijf, code) als primary
  id: serial("id").primaryKey(),
  bedrijf: varchar("bedrijf", { length: 4 }).notNull(),     // 'bb' | 'sl' | 'kl'
  transactionCode: varchar("transaction_code", { length: 64 }).notNull(),
  sumupId: varchar("sumup_id", { length: 64 }),
  bedrag: decimal("bedrag", { precision: 10, scale: 2 }).notNull(),
  valuta: varchar("valuta", { length: 8 }).default("EUR"),
  status: varchar("status", { length: 24 }).notNull(),       // SUCCESSFUL, FAILED, etc.
  paymentType: varchar("payment_type", { length: 32 }),
  cardType: varchar("card_type", { length: 32 }),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  ruwJson: text("ruw_json"),                                  // hele response bewaren voor later
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniekPerBedrijf: uniqueIndex("sumup_tx_bedrijf_code_uq").on(t.bedrijf, t.transactionCode),
  bedrijfTimeIdx: index("sumup_tx_bedrijf_ts_idx").on(t.bedrijf, t.timestamp),
  timeIdx: index("sumup_tx_ts_idx").on(t.timestamp),
}));

// Per bedrijf bijhouden tot wanneer we gesynchroniseerd zijn — dan
// hoeven we niet keer-op-keer alles te doorzoeken bij de cron.
export const sumupSyncState = pgTable("sumup_sync_state", {
  bedrijf: varchar("bedrijf", { length: 4 }).primaryKey(),
  laatsteSync: timestamp("laatste_sync", { withTimezone: true }).notNull(),
  laatsteTxTime: timestamp("laatste_tx_time", { withTimezone: true }),
  totaalGesynct: integer("totaal_gesynct").notNull().default(0),
  laatsteFout: text("laatste_fout"),
});

export type SumUpTx        = typeof sumupTransacties.$inferSelect;
export type NieuweSumUpTx  = typeof sumupTransacties.$inferInsert;
export type SumUpSyncState = typeof sumupSyncState.$inferSelect;

// ─── Zettle (iZettle) transacties — analoog aan SumUp ─────────────────────────
// Hele historie staat hier zodat de app niet keer-op-keer de paginated
// Zettle-API moet bellen. Backfill via /api/administratie/zettle-snapshot,
// daily cron prikt nieuwe transacties erbij.

export const zettleTransacties = pgTable("zettle_transacties", {
  id: serial("id").primaryKey(),
  bedrijf: varchar("bedrijf", { length: 4 }).notNull(),
  purchaseUuid: varchar("purchase_uuid", { length: 64 }).notNull(),
  bedrag: decimal("bedrag", { precision: 10, scale: 2 }).notNull(),     // in EUR (Zettle geeft centen → we delen door 100)
  btwBedrag: decimal("btw_bedrag", { precision: 10, scale: 2 }).default("0"),
  valuta: varchar("valuta", { length: 8 }).default("EUR"),
  refund: boolean("refund").notNull().default(false),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  producten: text("producten"),                                          // JSON.stringify(products) — voor top-producten analyse
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniekPerBedrijf: uniqueIndex("zettle_tx_bedrijf_uuid_uq").on(t.bedrijf, t.purchaseUuid),
  bedrijfTimeIdx: index("zettle_tx_bedrijf_ts_idx").on(t.bedrijf, t.timestamp),
  timeIdx: index("zettle_tx_ts_idx").on(t.timestamp),
}));

export const zettleSyncState = pgTable("zettle_sync_state", {
  bedrijf: varchar("bedrijf", { length: 4 }).primaryKey(),
  laatsteSync: timestamp("laatste_sync", { withTimezone: true }).notNull(),
  laatsteTxTime: timestamp("laatste_tx_time", { withTimezone: true }),
  totaalGesynct: integer("totaal_gesynct").notNull().default(0),
  laatsteFout: text("laatste_fout"),
});

export type ZettleTx        = typeof zettleTransacties.$inferSelect;
export type NieuweZettleTx  = typeof zettleTransacties.$inferInsert;
export type ZettleSyncState = typeof zettleSyncState.$inferSelect;

// ─── Gedeelde voorraad (magazijn bij Saté Lounge) ────────────────────────────
// Eén productlijst die de owner beheert (cola, water, handschoenen…). Andere
// vestigingen halen items op en loggen dat per stuk. Aan het einde van de
// maand wordt het totaal gefactureerd door SL aan de afnemende vestiging(en).

export const gedeeldeVoorraadProducten = pgTable("gedeelde_voorraad_producten", {
  id: serial("id").primaryKey(),
  naam:        varchar("naam", { length: 80 }).notNull(),
  categorie:   varchar("categorie", { length: 40 }),
  eenheid:     varchar("eenheid", { length: 20 }).notNull().default("stuk"),  // 'tray' | 'doos' | 'stuk' | 'kg' | 'liter'
  prijsPerEenheid: decimal("prijs_per_eenheid", { precision: 8, scale: 2 }),   // null = nog niet ingesteld door owner
  actief:      boolean("actief").notNull().default(true),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gedeeldeVoorraadAfnames = pgTable("gedeelde_voorraad_afnames", {
  id:           serial("id").primaryKey(),
  productId:    integer("product_id").notNull().references(() => gedeeldeVoorraadProducten.id, { onDelete: "cascade" }),
  voorBedrijf:  varchar("voor_bedrijf", { length: 4 }).notNull(),                                  // 'bb' | 'sl' | 'kl'
  aantal:       decimal("aantal", { precision: 8, scale: 2 }).notNull(),
  datum:        date("datum").notNull(),
  doorMedewerkerId: integer("door_medewerker_id").references(() => medewerkers.id, { onDelete: "set null" }),
  notitie:      text("notitie"),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  perBedrijfDatumIdx: index("afnames_bedrijf_datum_idx").on(t.voorBedrijf, t.datum),
  perProductDatumIdx: index("afnames_product_datum_idx").on(t.productId, t.datum),
}));

export type GedeeldProduct       = typeof gedeeldeVoorraadProducten.$inferSelect;
export type NieuwGedeeldProduct  = typeof gedeeldeVoorraadProducten.$inferInsert;
export type GedeeldeAfname       = typeof gedeeldeVoorraadAfnames.$inferSelect;
export type NieuweGedeeldeAfname = typeof gedeeldeVoorraadAfnames.$inferInsert;

// ─── Voorraad ────────────────────────────────────────────────────────────────
// Producten per vestiging (eenmalig setup) + live status (aantal + niveau)

export const voorraadProducten = pgTable("voorraad_producten", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").notNull().references(() => departments.id, { onDelete: "cascade" }),
  naam: varchar("naam", { length: 100 }).notNull(),
  eenheid: varchar("eenheid", { length: 30 }).default("stuk"),       // doos, fles, kg, pak
  categorie: varchar("categorie", { length: 60 }),                    // bv. "Koffie", "Bekers", "Schoonmaak"
  // Drempels (in absolute aantallen, lager = meer urgent)
  drempelKritiek: integer("drempel_kritiek").default(1),              // bv. "1 doos → bestel NU"
  drempelLaag:    integer("drempel_laag").default(3),                 // bv. "≤3 → bestel binnenkort"
  kritiekProduct: boolean("kritiek_product").notNull().default(false), // bv. "zonder bekers geen koffie"
  notitie:        text("notitie"),                                    // bv. leverancier, bestelinfo
  volgorde:       integer("volgorde").notNull().default(0),
  verwijderd:     boolean("verwijderd").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  deptIdx: index("voorraad_producten_dept_idx").on(t.departmentId, t.volgorde),
}));

export const voorraadStatus = pgTable("voorraad_status", {
  productId: integer("product_id").primaryKey().references(() => voorraadProducten.id, { onDelete: "cascade" }),
  aantal:    decimal("aantal", { precision: 8, scale: 2 }).notNull().default("0"),
  laatsteUpdate:    timestamp("laatste_update",     { withTimezone: true }).notNull().defaultNow(),
  laatsteUpdateDoor: integer("laatste_update_door").references(() => medewerkers.id, { onDelete: "set null" }),
});

export const voorraadProductenRelations = relations(voorraadProducten, ({ one }) => ({
  department: one(departments, { fields: [voorraadProducten.departmentId], references: [departments.id] }),
  status: one(voorraadStatus, { fields: [voorraadProducten.id], references: [voorraadStatus.productId] }),
}));

// ─── Review-referrals ────────────────────────────────────────────────────────
// Elke medewerker heeft een persoonlijke roterende QR (HMAC over
// medewerker-id + datum). Klant scant → /r/{token} → wij loggen 1 referral
// + redirect naar Google/TripAdvisor review-URL. Score-leaderboard telt
// referrals per medewerker.
//
// Twee rijen per scan: één "scan" (klant landde op interstitial) en
// optioneel één "click" (klant klikte daadwerkelijk door naar Google/Trip).
// Status = 'scan' bij landing, 'google'|'tripadvisor' bij doorklik.
export const reviewReferrals = pgTable("review_referrals", {
  id: serial("id").primaryKey(),
  medewerkerId: integer("medewerker_id").notNull().references(() => medewerkers.id, { onDelete: "cascade" }),
  bedrijfSlug: varchar("bedrijf_slug", { length: 8 }).notNull(),
  datum: date("datum").notNull(),                // datum van de QR-token (UTC)
  status: varchar("status", { length: 16 }).notNull().default("scan"), // 'scan' | 'google' | 'tripadvisor'
  ipHash: varchar("ip_hash", { length: 64 }),
  userAgent: varchar("user_agent", { length: 200 }),
  geregistreerdOp: timestamp("geregistreerd_op", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  medewerkerDatumIdx: index("review_referrals_medewerker_datum_idx").on(t.medewerkerId, t.datum),
  bedrijfDatumIdx: index("review_referrals_bedrijf_datum_idx").on(t.bedrijfSlug, t.datum),
  recentIdx: index("review_referrals_recent_idx").on(t.geregistreerdOp),
}));

// ─── Feedback reviews ────────────────────────────────────────────────────────
// (Deprecated — gebruikt door eerste experimentele team-QR aanpak. Tabel
// blijft staan voor historische data; nieuwe flow gebruikt reviewReferrals.)
export const feedbackReviews = pgTable("feedback_reviews", {
  id: serial("id").primaryKey(),
  bedrijfSlug: varchar("bedrijf_slug", { length: 8 }).notNull(),
  datum: date("datum").notNull(),
  sterren: integer("sterren").notNull(),
  tekst: text("tekst"),
  ipHash: varchar("ip_hash", { length: 64 }),
  ingediendOp: timestamp("ingediend_op", { withTimezone: true }).notNull().defaultNow(),
  // Soft-delete: owner kan een review verbergen (spam/fake) zonder hard-delete
  verborgen: boolean("verborgen").notNull().default(false),
}, (t) => ({
  bedrijfDatumIdx: index("feedback_reviews_bedrijf_datum_idx").on(t.bedrijfSlug, t.datum),
  ingediendIdx: index("feedback_reviews_ingediend_idx").on(t.ingediendOp),
}));

// ─── Medewerker passkeys (WebAuthn voor Face ID / Touch ID) ─────────────────
// Analoog aan het admin-passkey systeem in lib/webauthn.ts (KV-based), maar
// gekoppeld aan medewerker-id ipv admin-PIN. Eén medewerker kan meerdere
// apparaten registreren (iPhone + iPad). Counter wordt na elke succesvolle
// auth bijgewerkt — niet kritiek bij iCloud-keychain (sync zonder counter)
// maar netjes om te onderhouden.
export const medewerkerPasskeys = pgTable("medewerker_passkeys", {
  id: serial("id").primaryKey(),
  medewerkerId: integer("medewerker_id").notNull().references(() => medewerkers.id, { onDelete: "cascade" }),
  credentialId: varchar("credential_id", { length: 255 }).notNull(),  // base64url van browser
  publicKey:    text("public_key").notNull(),                          // base64url cose-key
  counter:      integer("counter").notNull().default(0),
  deviceLabel:  varchar("device_label", { length: 80 }).notNull(),     // bv. "iPhone Sara"
  aangemaakt:   timestamp("aangemaakt", { withTimezone: true }).notNull().defaultNow(),
  laatsteGebruikt: timestamp("laatste_gebruikt", { withTimezone: true }),
}, (t) => ({
  credIdx:       uniqueIndex("medewerker_passkeys_cred_idx").on(t.credentialId),
  medewerkerIdx: index("medewerker_passkeys_medewerker_idx").on(t.medewerkerId),
}));

// ─── Push subscriptions per medewerker (DB-backed) ──────────────────────────
// Apart van het bestaande KV-systeem (lib/push.ts) dat voor admin/eigenaar
// gebruikt wordt. Voor targeted notificaties willen we kunnen joinen op
// medewerker_id; daarom DB. Eén medewerker kan meerdere apparaten hebben.
export const medewerkerPushSubs = pgTable("medewerker_push_subs", {
  id: serial("id").primaryKey(),
  medewerkerId: integer("medewerker_id").notNull().references(() => medewerkers.id, { onDelete: "cascade" }),
  endpoint:    text("endpoint").notNull(),
  p256dh:      text("p256dh").notNull(),
  auth:        text("auth").notNull(),
  deviceLabel: varchar("device_label", { length: 80 }),
  aangemaakt:  timestamp("aangemaakt", { withTimezone: true }).notNull().defaultNow(),
  laatsteSucces: timestamp("laatste_succes", { withTimezone: true }),
}, (t) => ({
  endpointIdx:   uniqueIndex("mw_push_endpoint_idx").on(t.endpoint),
  medewerkerIdx: index("mw_push_medewerker_idx").on(t.medewerkerId),
}));

// ─── Ruilverzoeken ──────────────────────────────────────────────────────────
// Medewerker A kan voor een toekomstige dienst een ruilverzoek aanmaken.
// Collega's binnen dezelfde vestiging krijgen push + zien 'm in hun inbox.
// Eerste die "Ik neem 'm over" klikt reserveert (status=gereserveerd) en
// triggert een manager-notificatie. Manager keurt goed → rooster wordt
// automatisch aangepast (medewerker_id van het roster wijzigt naar overnemer).
//
// Status-flow:
//   open          → aanvrager wacht op iemand die wil overnemen
//   gereserveerd  → een collega heeft geklikt, wacht op manager-goedkeuring
//   goedgekeurd   → rooster is aangepast (terminal)
//   geweigerd     → manager wijst af; aanvraag gaat terug naar 'open'
//   ingetrokken   → aanvrager trekt 'm zelf terug (terminal)
//   verlopen      → dienst-datum is gepasseerd zonder overname (terminal)
export const ruilverzoeken = pgTable("ruilverzoeken", {
  id: serial("id").primaryKey(),
  rosterId: integer("roster_id").notNull().references(() => rosters.id, { onDelete: "cascade" }),
  aanvragerId: integer("aanvrager_id").notNull().references(() => medewerkers.id, { onDelete: "cascade" }),
  toelichting: text("toelichting"),

  status: varchar("status", { length: 16 }).notNull().default("open"),

  overnemerId:  integer("overnemer_id").references(() => medewerkers.id, { onDelete: "set null" }),
  overnemerGereserveerdOp: timestamp("overnemer_gereserveerd_op", { withTimezone: true }),

  managerId: integer("manager_id").references(() => medewerkers.id, { onDelete: "set null" }),
  beoordeeldOp: timestamp("beoordeeld_op", { withTimezone: true }),
  beoordelingsNotitie: text("beoordelings_notitie"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  statusIdx:    index("ruilverzoeken_status_idx").on(t.status),
  rosterIdx:    index("ruilverzoeken_roster_idx").on(t.rosterId),
  aanvragerIdx: index("ruilverzoeken_aanvrager_idx").on(t.aanvragerId),
  recentIdx:    index("ruilverzoeken_recent_idx").on(t.createdAt),
}));

export type Ruilverzoek = typeof ruilverzoeken.$inferSelect;
export type NieuwRuilverzoek = typeof ruilverzoeken.$inferInsert;

// ─── Dagafsluiting ──────────────────────────────────────────────────────────
// Eind-van-de-dag formulier dat medewerker invult: kas tellen + temperaturen
// (HACCP) + schoonmaak-checks + notities. Vervangt het WhatsApp-rapport.
//
// Eén rij per dept × datum (UNIQUE-index hieronder). Bij her-indienen mag
// medewerker hetzelfde record updaten tot het door manager is goedgekeurd.
//
// Kas-velden zijn ALLE in euro met 2 decimalen. Berekening is server-side:
//   contant_geteld = sum(munten_telling.aantal × waarde)
//   kas_omzet      = contant_geteld - startkassa_doel (≈ wat naar envelop ging
//                                                       minus fooi)
//   kas_verschil   = kas_omzet - (verwachte_contante_omzet_uit_pos)
// Bij |kas_verschil| > €2 is `verschil_toelichting` verplicht.
//
// JSONB-kolommen om flexibel te zijn met locaties/checks per vestiging zonder
// schema-migraties bij wijziging. Wel queryable via Postgres JSONB-operators.
export const dagafsluitingen = pgTable("dagafsluitingen", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").notNull().references(() => departments.id, { onDelete: "cascade" }),
  datum: date("datum").notNull(),

  // Indiening
  ingediendDoorId: integer("ingediend_door_id").references(() => medewerkers.id, { onDelete: "set null" }),
  ingediendOp: timestamp("ingediend_op", { withTimezone: true }).notNull().defaultNow(),

  // Kas-telling
  startkassaDoel:    decimal("startkassa_doel",    { precision: 8, scale: 2 }).notNull().default("100.00"),
  contantGeteldEur:  decimal("contant_geteld_eur", { precision: 8, scale: 2 }).notNull(),
  fooiEur:           decimal("fooi_eur",           { precision: 8, scale: 2 }).notNull().default("0"),
  enveloppeEur:      decimal("enveloppe_eur",      { precision: 8, scale: 2 }).notNull(),
  // Verwachte contante omzet (uit SumUp+Zettle cash-transacties), gecached
  // tijdens indienen voor latere vergelijking ook als POS-data wijzigt.
  verwachtContantEur: decimal("verwacht_contant_eur", { precision: 8, scale: 2 }),
  kasVerschilEur:     decimal("kas_verschil_eur",     { precision: 8, scale: 2 }),
  verschilToelichting: text("verschil_toelichting"),

  // POS-omzet snapshot (totaal incl. pin) voor referentie
  posOmzetTotaalEur:   decimal("pos_omzet_totaal_eur", { precision: 10, scale: 2 }),

  // Munten-telling (detail-bewijs van contantGeteldEur)
  // Schema: { "5c": n, "10c": n, "20c": n, "50c": n, "1e": n, "2e": n,
  //          "5e": n, "10e": n, "20e": n, "50e": n, "100e": n, "200e": n }
  muntenTelling: jsonb("munten_telling").$type<Record<string, number>>(),

  // Temperaturen — array met { locatie, waardeC, opmerking, tijdstip }
  temperaturen: jsonb("temperaturen").$type<Array<{
    locatie: string;
    waardeC: number;
    opmerking?: string;
    tijdstip?: string; // ISO timestamp
  }>>().notNull().default([] as never),

  // Schoonmaak-checks — array met { label, gedaan, opmerking }
  schoonmaakChecks: jsonb("schoonmaak_checks").$type<Array<{
    label: string;
    gedaan: boolean;
    opmerking?: string;
  }>>().notNull().default([] as never),

  // Boolean toggles
  enveloppeInKluis: boolean("enveloppe_in_kluis").notNull().default(false),
  alleSchoonmaakVoltooid: boolean("alle_schoonmaak_voltooid").notNull().default(false),

  notitie: text("notitie"),

  // Manager-controle
  gecontroleerdDoor: varchar("gecontroleerd_door", { length: 80 }),
  gecontroleerdOp:   timestamp("gecontroleerd_op", { withTimezone: true }),
  gecontroleerdeNotitie: text("gecontroleerde_notitie"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uq:        uniqueIndex("dagafsluitingen_dept_datum_uq").on(t.departmentId, t.datum),
  datumIdx:  index("dagafsluitingen_datum_idx").on(t.datum),
}));

export type Dagafsluiting = typeof dagafsluitingen.$inferSelect;
export type NieuweDagafsluiting = typeof dagafsluitingen.$inferInsert;

// Type-helpers voor consumers
export type Department      = typeof departments.$inferSelect;
export type Medewerker      = typeof medewerkers.$inferSelect;
export type NieuweMedewerker= typeof medewerkers.$inferInsert;
export type Roster          = typeof rosters.$inferSelect;
export type NieuwRoster     = typeof rosters.$inferInsert;
export type ShiftTemplate   = typeof shiftTemplates.$inferSelect;
export type Beschikbaarheid = typeof beschikbaarheid.$inferSelect;
export type KlokEvent       = typeof klokEvents.$inferSelect;
export type Sessie          = typeof sessies.$inferSelect;
export type AuditLog       = typeof auditLog.$inferSelect;
export type NieuweAuditLog = typeof auditLog.$inferInsert;
export type SalarisPeriode = typeof salarisPerioden.$inferSelect;
export type NieuweSalarisPeriode = typeof salarisPerioden.$inferInsert;
export type VoorraadProduct = typeof voorraadProducten.$inferSelect;
export type VoorraadStatus  = typeof voorraadStatus.$inferSelect;
export type FeedbackReview  = typeof feedbackReviews.$inferSelect;
export type NieuweFeedbackReview = typeof feedbackReviews.$inferInsert;
export type ReviewReferral = typeof reviewReferrals.$inferSelect;
export type NieuweReviewReferral = typeof reviewReferrals.$inferInsert;
