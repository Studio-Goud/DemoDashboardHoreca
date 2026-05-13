import {
  pgTable, serial, varchar, text, integer, boolean, timestamp, date, time,
  decimal, primaryKey, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Departments ─────────────────────────────────────────────────────────────
// 3 vestigingen: bb / sl / kl. Slug komt overeen met de URL.
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 8 }).notNull().unique(),
  naam: varchar("naam", { length: 100 }).notNull(),
  hex: varchar("hex", { length: 7 }).notNull(),
  // Voor migratie van Shiftbase
  shiftbaseDepartmentId: varchar("shiftbase_department_id", { length: 32 }),
  shiftbaseTeamId:       varchar("shiftbase_team_id",       { length: 32 }),
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
  registratieToken:       varchar("registratie_token", { length: 64 }),
  registratieVerloopt:    timestamp("registratie_verloopt", { withTimezone: true }),
  laatsteLogin:           timestamp("laatste_login",        { withTimezone: true }),

  avatarUrl: text("avatar_url"),
  actief:    boolean("actief").notNull().default(true),

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
export type VoorraadProduct = typeof voorraadProducten.$inferSelect;
export type VoorraadStatus  = typeof voorraadStatus.$inferSelect;
