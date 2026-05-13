/**
 * i18n dictionaries — NL (default), EN, PT.
 *
 * Strings staan plat in een object zodat new strings simpel kunnen worden
 * toegevoegd. Geen nesting; gebruik dot-notation in keys.
 */

export type Taal = "nl" | "en" | "pt";

export const TALEN: Array<{ code: Taal; naam: string; vlag: string }> = [
  { code: "nl", naam: "Nederlands", vlag: "🇳🇱" },
  { code: "en", naam: "English",    vlag: "🇬🇧" },
  { code: "pt", naam: "Português",  vlag: "🇵🇹" },
];

type Dictionary = Record<string, string>;

const nl: Dictionary = {
  // Algemeen
  "common.back": "Terug",
  "common.cancel": "Annuleer",
  "common.save": "Opslaan",
  "common.delete": "Verwijderen",
  "common.edit": "Bewerken",
  "common.add": "Toevoegen",
  "common.loading": "Laden…",
  "common.busy": "Bezig…",
  "common.today": "Vandaag",
  "common.tomorrow": "Morgen",
  "common.required": "verplicht",
  "common.optional": "optioneel",
  "common.next": "Volgende",
  "common.previous": "Vorige",
  "common.logout": "Uitloggen",

  // Login
  "login.title": "Voer PIN in",
  "login.subtitle": "Studio Goud",
  "login.wrong": "Onjuiste PIN",
  "login.welcome": "Welkom",
  "login.choose_pin": "Kies een 4-cijferige PIN",
  "login.confirm_pin": "Bevestig je PIN",
  "login.choose_location": "Welke vestiging beheer je?",

  // Dashboard tabs
  "tab.revenue": "Omzet",
  "tab.planning": "Planning",
  "tab.schedule": "Rooster",
  "tab.hours": "Uren",
  "tab.inventory": "Voorraad",
  "tab.products": "Producten",
  "tab.insights": "Inzichten",
  "tab.admin": "Administratie",

  // Rooster
  "schedule.today": "Rooster vandaag",
  "schedule.this_week": "Komende week",
  "schedule.now_working": "Nu aan het werk",
  "schedule.coming": "Komen nog",
  "schedule.done": "Klaar voor vandaag",
  "schedule.publish": "Publiceer",
  "schedule.add_shift": "+ voeg toe",
  "schedule.force_add": "+ toch inplannen",
  "schedule.employees": "Medewerkers",
  "schedule.no_shifts": "Geen diensten gepland",

  // Beschikbaarheid
  "availability.free": "Vrij",
  "availability.limited": "Tijden",
  "availability.unavailable": "Niet",
  "availability.not_set": "Niet opgegeven",
  "availability.all_day": "Hele dag beschikbaar",
  "availability.clear": "Wissen (geen voorkeur)",

  // Voorraad
  "inventory.title": "Voorraad",
  "inventory.add_product": "+ Product toevoegen",
  "inventory.order_list": "Bestellijst",
  "inventory.order_now": "DIRECT BESTELLEN — kritieke producten",
  "inventory.products": "producten",
  "inventory.to_order": "te bestellen",
  "inventory.level_full": "Op voorraad",
  "inventory.level_low": "Laag",
  "inventory.level_critical": "Kritiek",
  "inventory.level_empty": "Op",
  "inventory.live_label": "Live · ververst elke 30s",
  "inventory.no_products": "Nog geen producten",
  "inventory.alerts_label": "Meldingen — wanneer waarschuwen?",
  "inventory.threshold_low": "Bestel binnenkort bij ≤",
  "inventory.threshold_critical": "DIRECT bestellen bij ≤",
  "inventory.critical_product": "Kritiek product — bar dicht zonder dit",

  // Klok
  "clock.in": "Inklokken",
  "clock.out": "Uitklokken",
  "clock.in_status": "Ingeklokt",
  "clock.out_status": "Niet ingeklokt",
  "clock.recent": "Recente klokken",
};

const en: Dictionary = {
  "common.back": "Back",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.add": "Add",
  "common.loading": "Loading…",
  "common.busy": "Working…",
  "common.today": "Today",
  "common.tomorrow": "Tomorrow",
  "common.required": "required",
  "common.optional": "optional",
  "common.next": "Next",
  "common.previous": "Previous",
  "common.logout": "Sign out",

  "login.title": "Enter PIN",
  "login.subtitle": "Studio Goud",
  "login.wrong": "Wrong PIN",
  "login.welcome": "Welcome",
  "login.choose_pin": "Choose a 4-digit PIN",
  "login.confirm_pin": "Confirm your PIN",
  "login.choose_location": "Which location do you manage?",

  "tab.revenue": "Revenue",
  "tab.planning": "Planning",
  "tab.schedule": "Schedule",
  "tab.hours": "Hours",
  "tab.inventory": "Inventory",
  "tab.products": "Products",
  "tab.insights": "Insights",
  "tab.admin": "Admin",

  "schedule.today": "Schedule today",
  "schedule.this_week": "This week",
  "schedule.now_working": "Working now",
  "schedule.coming": "Coming up",
  "schedule.done": "Done for today",
  "schedule.publish": "Publish",
  "schedule.add_shift": "+ add",
  "schedule.force_add": "+ schedule anyway",
  "schedule.employees": "Employees",
  "schedule.no_shifts": "No shifts scheduled",

  "availability.free": "Available",
  "availability.limited": "Hours",
  "availability.unavailable": "No",
  "availability.not_set": "Not set",
  "availability.all_day": "Available all day",
  "availability.clear": "Clear (no preference)",

  "inventory.title": "Inventory",
  "inventory.add_product": "+ Add product",
  "inventory.order_list": "Order list",
  "inventory.order_now": "ORDER NOW — critical items",
  "inventory.products": "products",
  "inventory.to_order": "to order",
  "inventory.level_full": "In stock",
  "inventory.level_low": "Low",
  "inventory.level_critical": "Critical",
  "inventory.level_empty": "Out",
  "inventory.live_label": "Live · refreshes every 30s",
  "inventory.no_products": "No products yet",
  "inventory.alerts_label": "Alerts — when to warn?",
  "inventory.threshold_low": "Order soon at ≤",
  "inventory.threshold_critical": "ORDER NOW at ≤",
  "inventory.critical_product": "Critical product — bar closes without it",

  "clock.in": "Clock in",
  "clock.out": "Clock out",
  "clock.in_status": "Clocked in",
  "clock.out_status": "Not clocked in",
  "clock.recent": "Recent clocks",
};

const pt: Dictionary = {
  "common.back": "Voltar",
  "common.cancel": "Cancelar",
  "common.save": "Guardar",
  "common.delete": "Eliminar",
  "common.edit": "Editar",
  "common.add": "Adicionar",
  "common.loading": "A carregar…",
  "common.busy": "A processar…",
  "common.today": "Hoje",
  "common.tomorrow": "Amanhã",
  "common.required": "obrigatório",
  "common.optional": "opcional",
  "common.next": "Seguinte",
  "common.previous": "Anterior",
  "common.logout": "Terminar sessão",

  "login.title": "Inserir PIN",
  "login.subtitle": "Studio Goud",
  "login.wrong": "PIN incorreto",
  "login.welcome": "Bem-vindo",
  "login.choose_pin": "Escolhe um PIN de 4 dígitos",
  "login.confirm_pin": "Confirma o teu PIN",
  "login.choose_location": "Qual estabelecimento geres?",

  "tab.revenue": "Receita",
  "tab.planning": "Planeamento",
  "tab.schedule": "Horário",
  "tab.hours": "Horas",
  "tab.inventory": "Stock",
  "tab.products": "Produtos",
  "tab.insights": "Análises",
  "tab.admin": "Administração",

  "schedule.today": "Horário de hoje",
  "schedule.this_week": "Esta semana",
  "schedule.now_working": "A trabalhar agora",
  "schedule.coming": "Em breve",
  "schedule.done": "Já fizeram",
  "schedule.publish": "Publicar",
  "schedule.add_shift": "+ adicionar",
  "schedule.force_add": "+ marcar mesmo assim",
  "schedule.employees": "Funcionários",
  "schedule.no_shifts": "Sem turnos marcados",

  "availability.free": "Disponível",
  "availability.limited": "Horários",
  "availability.unavailable": "Não",
  "availability.not_set": "Não definido",
  "availability.all_day": "Disponível o dia todo",
  "availability.clear": "Limpar (sem preferência)",

  "inventory.title": "Stock",
  "inventory.add_product": "+ Adicionar produto",
  "inventory.order_list": "Lista de encomenda",
  "inventory.order_now": "ENCOMENDAR JÁ — itens críticos",
  "inventory.products": "produtos",
  "inventory.to_order": "para encomendar",
  "inventory.level_full": "Em stock",
  "inventory.level_low": "Baixo",
  "inventory.level_critical": "Crítico",
  "inventory.level_empty": "Esgotado",
  "inventory.live_label": "Em direto · atualiza a cada 30s",
  "inventory.no_products": "Ainda não há produtos",
  "inventory.alerts_label": "Alertas — quando avisar?",
  "inventory.threshold_low": "Encomendar em breve com ≤",
  "inventory.threshold_critical": "ENCOMENDAR JÁ com ≤",
  "inventory.critical_product": "Produto crítico — bar fecha sem isto",

  "clock.in": "Picar entrada",
  "clock.out": "Picar saída",
  "clock.in_status": "Em serviço",
  "clock.out_status": "Fora de serviço",
  "clock.recent": "Picagens recentes",
};

export const DICTIONARIES: Record<Taal, Dictionary> = { nl, en, pt };

export function t(taal: Taal, key: string): string {
  return DICTIONARIES[taal][key] ?? DICTIONARIES.nl[key] ?? key;
}
