import React, { createContext, useContext } from "react";

export const LangCtx = createContext("en");
export const useLang = () => useContext(LangCtx);

const dict = {
  // Navigation — main
  home:          { en: "Home",          nl: "Home" },
  inbox:         { en: "Inbox",         nl: "Inbox" },
  tasks:         { en: "Tasks",         nl: "Taken" },
  workflows:     { en: "Workflows",     nl: "Workflows" },
  automations:   { en: "Automations",   nl: "Automatiseringen" },
  onboarding:    { en: "Onboarding",    nl: "Onboarding" },

  // Navigation — objects section
  objects:       { en: "Objects",       nl: "Objecten" },
  views:         { en: "Views",         nl: "Weergaven" },
  buildings:     { en: "Complexes",     nl: "Complexen" },
  services:      { en: "Services",     nl: "Diensten" },
  suppliers:     { en: "Suppliers",    nl: "Leveranciers" },
  meters:        { en: "Meters",        nl: "Meters" },

  // Common labels
  overview:      { en: "Overview",      nl: "Overzicht" },
  status:        { en: "Status",        nl: "Status" },
  search:        { en: "Search",        nl: "Zoeken" },
  details:       { en: "Details",       nl: "Details" },
  settings:      { en: "Settings",      nl: "Instellingen" },
  name:          { en: "Name",          nl: "Naam" },
  type:          { en: "Type",          nl: "Type" },
  address:       { en: "Address",       nl: "Adres" },
  date:          { en: "Date",          nl: "Datum" },
  description:   { en: "Description",   nl: "Beschrijving" },
  actions:       { en: "Actions",       nl: "Acties" },
  filter:        { en: "Filter",        nl: "Filter" },
  all:           { en: "All",           nl: "Alle" },
  active:        { en: "Active",        nl: "Actief" },
  inactive:      { en: "Inactive",      nl: "Inactief" },
  noResults:     { en: "No results found", nl: "Geen resultaten gevonden" },

  // Building list columns
  complex:         { en: "Complex",          nl: "Complex" },
  complexId:       { en: "Complex ID",       nl: "Complex ID" },
  location:        { en: "Location",         nl: "Locatie" },
  vhe:             { en: "VHE",              nl: "VHE" },
  components:      { en: "Services",         nl: "Diensten" },
  utilities:       { en: "Utilities",        nl: "Nutsvoorzieningen" },
  budgetProgress:  { en: "Budget",           nl: "Budget" },
  dataQuality:     { en: "Data Quality",     nl: "Datakwaliteit" },

  // Page titles
  homeTitle:     { en: "Dashboard",     nl: "Dashboard" },
  homeSubtitle:  { en: "Welcome back",  nl: "Welkom terug" },
  inboxTitle:    { en: "Inbox",         nl: "Inbox" },
  tasksTitle:    { en: "Tasks",         nl: "Taken" },
  workflowsTitle:    { en: "Workflows",     nl: "Workflows" },
  automationsTitle:  { en: "Automations",   nl: "Automatiseringen" },
  onboardingTitle:   { en: "Onboarding",    nl: "Onboarding" },
  buildingsTitle:    { en: "Complexes",     nl: "Complexen" },
  metersTitle:       { en: "Meters",        nl: "Meters" },
  servicesTitle:     { en: "Services",     nl: "Diensten" },
  suppliersTitle:    { en: "Suppliers",    nl: "Leveranciers" },

  // Service list columns
  code:              { en: "Code",         nl: "Code" },
  service:           { en: "Service",      nl: "Dienst" },
  category:          { en: "Category",     nl: "Categorie" },
  regulation:        { en: "Regulation",   nl: "Regelgeving" },
  metered:           { en: "Metered",      nl: "Gemeten" },
  variable:          { en: "Variable",     nl: "Variabel" },
  buildingCount:     { en: "Complexes",    nl: "Complexen" },
  avgCostVhe:        { en: "Avg / VHE",    nl: "Gem. / VHE" },

  // Service categories
  energy:            { en: "Energy & Water",               nl: "Energie & Water" },
  installations:     { en: "Installations & Maintenance",  nl: "Installaties & Technisch Beheer" },
  cleaning:          { en: "Cleaning & Exterior",          nl: "Schoonmaak & Buitenruimte" },
  management:        { en: "Management & Services",        nl: "Beheer & Woonservices" },
  other:             { en: "Other & Insurance",            nl: "Overig & Verzekeringen" },

  // VHE attributes
  vheType:           { en: "Type",             nl: "Type" },
  apartment:         { en: "Apartment",        nl: "Appartement" },
  studio:            { en: "Studio",           nl: "Studio" },
  parking:           { en: "Parking",          nl: "Parkeerplaats" },
  commercial:        { en: "Commercial",       nl: "Bedrijfsruimte" },
  inMutation:        { en: "In mutation",      nl: "In mutatie" },

  // Meter attributes
  utility:           { en: "Utility",          nl: "Nutssoort" },
  eanCode:           { en: "EAN",              nl: "EAN" },
  consumption:       { en: "Consumption",      nl: "Verbruik" },
  previousReading:   { en: "Start reading",    nl: "Beginstand" },
  currentReading:    { en: "Current reading",  nl: "Huidige stand" },
  meterHealth:       { en: "Meter Health",     nl: "Meterstatus" },
  readingsUpToDate:  { en: "Readings up to date", nl: "Standen actueel" },
  readingsOverdue:   { en: "Readings overdue", nl: "Standen verlopen" },
  submeter:          { en: "Submeter",         nl: "Submeter" },
  submeters:         { en: "Submeters",        nl: "Submeters" },
  mainMeter:         { en: "Main Meter",       nl: "Hoofdmeter" },
  meterReading:      { en: "Meter Reading",    nl: "Meterstand" },
  noReading:         { en: "No reading",       nl: "Geen stand" },
  heat:              { en: "Heat",             nl: "Warmte" },
  water:             { en: "Water",            nl: "Water" },
  warmWater:         { en: "Hot Water",        nl: "Warm water" },
  electricity:       { en: "Electricity",      nl: "Elektra" },
  locked:            { en: "Locked",           nl: "Vergrendeld" },
  historical:        { en: "Historical",       nl: "Historisch" },

  // Supplier list columns
  supplier:          { en: "Supplier",            nl: "Leverancier" },
  supplierServices:  { en: "Services",            nl: "Diensten" },
  annualSpend:       { en: "Annual Spend",        nl: "Jaaromzet" },
  rating:            { en: "Rating",              nl: "Beoordeling" },
  contractEnd:       { en: "Contract End",        nl: "Contracteinde" },
  city:              { en: "City",                nl: "Plaats" },
  kvk:               { en: "KVK",                 nl: "KVK" },
  contactPerson:     { en: "Contact",             nl: "Contactpersoon" },

  // Kostenverdeler (external distribution)
  externalDistribution: { en: "External Distribution", nl: "Extern verdeeld" },
  distributedBy:     { en: "Distributed by", nl: "Verdeeld door" },
  internalDistribution: { en: "Internal Distribution", nl: "Eigen verdeling" },
  changesVia:        { en: "Changes via",    nl: "Wijzigingen via" },
  kostenverdeler:    { en: "Cost distributor", nl: "Kostenverdeler" },

  // Boolean labels
  yes:               { en: "Yes",          nl: "Ja" },
  no:                { en: "No",           nl: "Nee" },

  // Building detail page
  actual:            { en: "Actual",              nl: "Werkelijk" },
  variance:          { en: "Variance",            nl: "Afwijking" },
  underBudget:       { en: "Under budget",        nl: "Onder budget" },
  overBudget:        { en: "Over budget",         nl: "Over budget" },
  activeServices:    { en: "Services",            nl: "Diensten" },
  mainMeters:        { en: "Main Meters",         nl: "Hoofdmeters" },
  subMeters:         { en: "Sub Meters",          nl: "Submeters" },
  costBreakdown:     { en: "Cost Breakdown",      nl: "Kostenverdeling" },
  completeness:      { en: "Completeness",        nl: "Volledigheid" },
  distributionMethod: { en: "Distribution",       nl: "Verdeelsleutel" },
  lastReading:       { en: "Last reading",        nl: "Laatste stand" },
  meterNumber:       { en: "Meter No.",           nl: "Meternr." },
  activity:          { en: "Activity",            nl: "Activiteit" },
  vacant:            { en: "Vacant",              nl: "Leegstaand" },
  unit:              { en: "Unit",                nl: "Eenheid" },
  floor:             { en: "Floor",               nl: "Verdieping" },
  m2:                { en: "m²",                  nl: "m²" },
  voorschot:         { en: "Voorschot",           nl: "Voorschot" },
  contract:          { en: "Contract",            nl: "Contract" },
  contractNumber:    { en: "Contract No.",        nl: "Contractnr." },
  startDate:         { en: "Start Date",          nl: "Startdatum" },
  endDate:           { en: "End Date",            nl: "Einddatum" },
  voorschotBreakdown:{ en: "Advance Breakdown",   nl: "Voorschotspecificatie" },
  advancePerComponent:{ en: "Advance per Component", nl: "Voorschot per component" },
  totalAdvance:      { en: "Total Advance",       nl: "Totaal voorschot" },
  contractActive:    { en: "Active",              nl: "Actief" },
  contractEnded:     { en: "Ended",               nl: "Beëindigd" },
  noContract:        { en: "No contract",         nl: "Geen contract" },

  // VHE
  vheTitle:          { en: "VHE",                 nl: "VHE" },
};

export function t(key, lang = "en") {
  const entry = dict[key];
  if (!entry) return key;
  return entry[lang] || entry.en || key;
}
