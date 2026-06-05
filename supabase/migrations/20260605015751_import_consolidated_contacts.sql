-- Import consolidated client agents into canonical public.contacts.
-- Source: 88 CONTACT.md files (Obsidian 05_AGENTS), gathered + deduped by email
--         via scripts/contacts-consolidation/{normalize,dedupe,parse,gather}.ts.
-- Scope 1 (Contact-of-Truth) of the System Consolidation Gameplan.
--
-- Idempotent: ON CONFLICT (email) upsert. Never deletes (soft-delete-safe).
-- account_id / user_id are resolved by Alex's canonical login email so the same
-- file applies unchanged to local and prod. If prod's owner email differs, the
-- guard below fails loudly rather than silently inserting zero rows.
-- Two legacy tier labels ('1 (CORE REVENUE)' for Chris Bianco + Julie Jarmiolowski)
-- are normalized to 'A' to satisfy the contacts_tier_check (A/B/C/P).

do $guard$
begin
  if not exists (
    select 1 from public.accounts a
    join auth.users u on u.id = a.owner_user_id
    where u.email = 'alex@alexhollienco.com'
  ) then
    raise exception 'Canonical account for alex@alexhollienco.com not found in this environment; set the owner email or hardcode account_id before applying.';
  end if;
end
$guard$;

with acct as (
  select a.id as account_id, a.owner_user_id as user_id
  from public.accounts a
  join auth.users u on u.id = a.owner_user_id
  where u.email = 'alex@alexhollienco.com'
  limit 1
),
src as (
  select * from jsonb_to_recordset($contacts$
[
  {
    "firstName": "Aaron",
    "lastName": "Tena",
    "fullName": "Aaron Tena",
    "email": "at3homes@gmail.com",
    "phone": "",
    "brokerage": "Barrett Real Estate",
    "city": "Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Adely",
    "lastName": "Hunt",
    "fullName": "Adely Hunt",
    "email": "hunt@homesearchpro.net",
    "phone": "",
    "brokerage": "My Home Group",
    "city": "Scottsdale",
    "tier": "B"
  },
  {
    "firstName": "Alexandra",
    "lastName": "Best",
    "fullName": "Alexandra Best",
    "email": "bestalexandra3@gmail.com",
    "phone": "",
    "brokerage": "Caliber Realty Group, LLC",
    "city": "Scottsdale",
    "tier": "B"
  },
  {
    "firstName": "Alexis",
    "lastName": "Marlow",
    "fullName": "Alexis Marlow",
    "email": "a.marlow0120@gmail.com",
    "phone": "",
    "brokerage": "Barrett Real Estate",
    "city": "Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Allery",
    "lastName": "Stuart",
    "fullName": "Allery Stuart",
    "email": "allery@infinitebeaconhomes.com",
    "phone": "",
    "brokerage": "Coldwell Banker Realty",
    "city": "Scottsdale",
    "tier": "A"
  },
  {
    "firstName": "Alym",
    "lastName": "Dhalla",
    "fullName": "Alym Dhalla",
    "email": "adhalla@gmail.com",
    "phone": "",
    "brokerage": "Orchard",
    "city": "Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Amber",
    "lastName": "Hollien",
    "fullName": "Amber Hollien",
    "email": "amber@amberhollien.com",
    "phone": "",
    "brokerage": "My Home Group",
    "city": "Scottsdale",
    "tier": "A"
  },
  {
    "firstName": "Amy",
    "lastName": "Koch",
    "fullName": "Amy Koch",
    "email": "amy@amykoch.com",
    "phone": "",
    "brokerage": "The Brokery",
    "city": "Phoenix, Desert Ridge, Scottsdale",
    "tier": "A"
  },
  {
    "firstName": "Angel",
    "lastName": "Villa",
    "fullName": "Angel Villa",
    "email": "angelvillare2023@gmail.com",
    "phone": "",
    "brokerage": "Barrett Real Estate",
    "city": "Mesa, Phoenix, Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Anna",
    "lastName": "Gurczak",
    "fullName": "Anna Gurczak",
    "email": "annasellsarizona@gmail.com",
    "phone": "",
    "brokerage": "Grand Canyon Realty",
    "city": "Scottsdale",
    "tier": "B"
  },
  {
    "firstName": "Anne",
    "lastName": "Schilling",
    "fullName": "Anne Schilling",
    "email": "schillingsellingscottsdale@gmail.com",
    "phone": "",
    "brokerage": "Schilling Fine Homes",
    "city": "Kierland, Scottsdale",
    "tier": "A"
  },
  {
    "firstName": "Anthony",
    "lastName": "Stallone",
    "fullName": "Anthony Stallone",
    "email": "stallonerealty@yahoo.com",
    "phone": "",
    "brokerage": "HomeSmart",
    "city": "Scottsdale",
    "tier": "A"
  },
  {
    "firstName": "Becca",
    "lastName": "Linnig",
    "fullName": "Becca Linnig",
    "email": "becca@imbeccablerealestate.com",
    "phone": "",
    "brokerage": "RE/MAX Fine Properties",
    "city": "Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Brandon",
    "lastName": "Austin",
    "fullName": "Brandon Austin",
    "email": "brandonaustin290@gmail.com",
    "phone": "",
    "brokerage": "Barrett Real Estate",
    "city": "Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Brandon",
    "lastName": "Gaston",
    "fullName": "Brandon Gaston",
    "email": "bgaston@kw.com",
    "phone": "",
    "brokerage": "Keller Williams Sonoran Living",
    "city": "Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Brianna",
    "lastName": "Rael",
    "fullName": "Brianna Rael",
    "email": "keysbybrianna@gmail.com",
    "phone": "",
    "brokerage": "Keller Williams Sonoran Living",
    "city": "Scottsdale",
    "tier": "B"
  },
  {
    "firstName": "Bruce",
    "lastName": "Dahlke",
    "fullName": "Bruce Dahlke",
    "email": "bdahlke2025@gmail.com",
    "phone": "",
    "brokerage": "Ventana Fine Properties",
    "city": "Scottsdale",
    "tier": "A"
  },
  {
    "firstName": "Bruce",
    "lastName": "Schwartz",
    "fullName": "Bruce Schwartz",
    "email": "drbruceschwartz@yahoo.com",
    "phone": "",
    "brokerage": "HomeSmart",
    "city": "Scottsdale",
    "tier": "A"
  },
  {
    "firstName": "Carrie",
    "lastName": "Lehrman",
    "fullName": "Carrie Lehrman",
    "email": "carrie@thesrlgroup.com",
    "phone": "",
    "brokerage": "SRL Group",
    "city": "Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Charles",
    "lastName": "Martinet",
    "fullName": "Charles Martinet",
    "email": "cmartinet@gcanyonrealty.com",
    "phone": "",
    "brokerage": "Grand Canyon Realty",
    "city": "Scottsdale",
    "tier": "B"
  },
  {
    "firstName": "Chase",
    "lastName": "Reynolds",
    "fullName": "Chase Reynolds",
    "email": "chase.c.reynolds@gmail.com",
    "phone": "",
    "brokerage": "Ventana Fine Properties",
    "city": "Scottsdale",
    "tier": "A"
  },
  {
    "firstName": "Chris",
    "lastName": "Bianco",
    "fullName": "Chris Bianco",
    "email": "cbiancodtc@gmail.com",
    "phone": "6022912090",
    "brokerage": "Civic Center Real Estate (CCRE)",
    "city": "Phoenix -- Valle Venado (85020), North Central Phoenix, Paradise Valley adjacent",
    "tier": "A"
  },
  {
    "firstName": "Chris",
    "lastName": "Ringhofer",
    "fullName": "Chris Ringhofer",
    "email": "christopher.ringhofer@gmail.com",
    "phone": "",
    "brokerage": "Compass",
    "city": "Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Colleen",
    "lastName": "Malley Schwartz",
    "fullName": "Colleen Malley Schwartz",
    "email": "colleenmalley33@yahoo.com",
    "phone": "",
    "brokerage": "HomeSmart",
    "city": "Scottsdale",
    "tier": "A"
  },
  {
    "firstName": "Courtney",
    "lastName": "Cagle",
    "fullName": "Courtney Cagle",
    "email": "courtbcagle21@gmail.com",
    "phone": "",
    "brokerage": "Barrett Real Estate",
    "city": "Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Dahee",
    "lastName": "Kim",
    "fullName": "Dahee Kim",
    "email": "dahee@thealdergroupaz.com",
    "phone": "",
    "brokerage": "Real Broker",
    "city": "Tucson, Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Danielle",
    "lastName": "Rufenacht",
    "fullName": "Danielle Rufenacht",
    "email": "realtordaniisellsaz@gmail.com",
    "phone": "",
    "brokerage": "A.Z. & Associates",
    "city": "Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Denise",
    "lastName": "van den Bossche",
    "fullName": "Denise van den Bossche",
    "email": "denisevdb@exec-elite.com",
    "phone": "",
    "brokerage": "Realty Executives Arizona Territory",
    "city": "Scottsdale",
    "tier": "A"
  },
  {
    "firstName": "Destany",
    "lastName": "Ramirez",
    "fullName": "Destany Ramirez",
    "email": "desramirez08@gmail.com",
    "phone": "",
    "brokerage": "eXp Realty",
    "city": "Peoria, Scottsdale",
    "tier": "B"
  },
  {
    "firstName": "Donna",
    "lastName": "Cilley",
    "fullName": "Donna Cilley",
    "email": "thecilleys@gmail.com",
    "phone": "",
    "brokerage": "Realty Executives Arizona Territory",
    "city": "Scottsdale",
    "tier": "A"
  },
  {
    "firstName": "Doug",
    "lastName": "Summers",
    "fullName": "Doug Summers",
    "email": "realtorsumms@gmail.com",
    "phone": "",
    "brokerage": "Barrett Real Estate",
    "city": "Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Eli",
    "lastName": "Khazoom",
    "fullName": "Eli Khazoom",
    "email": "eli@khazoomrealestate.com",
    "phone": "",
    "brokerage": "HomeSmart",
    "city": "Scottsdale",
    "tier": "B"
  },
  {
    "firstName": "Emma",
    "lastName": "Mastre",
    "fullName": "Emma Mastre",
    "email": "ecmastre@gmail.com",
    "phone": "",
    "brokerage": "Ventana Fine Properties",
    "city": "Scottsdale",
    "tier": "A"
  },
  {
    "firstName": "Fiona",
    "lastName": "Bigbee",
    "fullName": "Fiona Bigbee",
    "email": "fiona.bigbee@gmail.com",
    "phone": "",
    "brokerage": "Coldwell Banker Realty",
    "city": "Scottsdale",
    "tier": "B"
  },
  {
    "firstName": "Gary",
    "lastName": "Vieth",
    "fullName": "Gary Vieth",
    "email": "gviethassoc@cox.net",
    "phone": "",
    "brokerage": "Gary L. Vieth & Assoc., Inc",
    "city": "Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Gregory",
    "lastName": "Anderson",
    "fullName": "Gregory Anderson",
    "email": "greand03@gmail.com",
    "phone": "",
    "brokerage": "Caliber Realty Group, LLC",
    "city": "Scottsdale",
    "tier": "B"
  },
  {
    "firstName": "Hema",
    "lastName": "Patel",
    "fullName": "Hema Patel",
    "email": "hemaazrealtor@gmail.com",
    "phone": "",
    "brokerage": "HomeSmart",
    "city": "Scottsdale",
    "tier": "P"
  },
  {
    "firstName": "Hend",
    "lastName": "Faraj",
    "fullName": "Hend Faraj",
    "email": "homehuntersaz@gmail.com",
    "phone": "",
    "brokerage": "Home Hunters Realty",
    "city": "Peoria, Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Jeff",
    "lastName": "Li",
    "fullName": "Jeff Li",
    "email": "jeff.integritygroup@gmail.com",
    "phone": "",
    "brokerage": "Delex Realty",
    "city": "Mesa, Phoenix, Scottsdale",
    "tier": "B"
  },
  {
    "firstName": "Jeffrey",
    "lastName": "Otero",
    "fullName": "Jeffrey Otero",
    "email": "jeffotero@yahoo.com",
    "phone": "",
    "brokerage": "Home Hunters Realty",
    "city": "Peoria, Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Jenn",
    "lastName": "Phipps",
    "fullName": "Jenn Phipps",
    "email": "jennphipps@icloud.com",
    "phone": "",
    "brokerage": "West USA",
    "city": "Scottsdale",
    "tier": "B"
  },
  {
    "firstName": "Jennifer",
    "lastName": "Schilling",
    "fullName": "Jennifer Schilling",
    "email": "jenniferl.schilling@gmail.com",
    "phone": "",
    "brokerage": "Schilling Fine Homes",
    "city": "Kierland, Scottsdale",
    "tier": "A"
  },
  {
    "firstName": "Joey",
    "lastName": "Gutierrez",
    "fullName": "Joey Gutierrez",
    "email": "homeprosreco@gmail.com",
    "phone": "",
    "brokerage": "Barrett Real Estate",
    "city": "Mesa, Phoenix, Scottsdale",
    "tier": "B"
  },
  {
    "firstName": "Julie",
    "lastName": "Jarmiolowski",
    "fullName": "Julie Jarmiolowski",
    "email": "julie@kay-grant.com",
    "phone": "6026635256",
    "brokerage": "The Kay-Grant Group / My Home Group",
    "city": "Scottsdale, Paradise Valley, Arcadia",
    "tier": "A"
  },
  {
    "firstName": "Karine",
    "lastName": "Richards",
    "fullName": "Karine Richards",
    "email": "karine.azrealtor@gmail.com",
    "phone": "",
    "brokerage": "HomeSmart",
    "city": "Scottsdale",
    "tier": "B"
  },
  {
    "firstName": "Kathy",
    "lastName": "Cohodas",
    "fullName": "Kathy Cohodas",
    "email": "kathy.cohodas@gmail.com",
    "phone": "",
    "brokerage": "My Home Group",
    "city": "Scottsdale",
    "tier": "P"
  },
  {
    "firstName": "Kay",
    "lastName": "Moore",
    "fullName": "Kay Moore",
    "email": "kmoore491@yahoo.com",
    "phone": "",
    "brokerage": "Barrett Real Estate",
    "city": "Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Kiersten",
    "lastName": "Tessler",
    "fullName": "Kiersten Tessler",
    "email": "kiersten@tackettteam.com",
    "phone": "",
    "brokerage": "eXp Realty",
    "city": "Scottsdale",
    "tier": "B"
  },
  {
    "firstName": "Kirk",
    "lastName": "Dahlke",
    "fullName": "Kirk Dahlke",
    "email": "kirkdahlke225@gmail.com",
    "phone": "",
    "brokerage": "My Home Group",
    "city": "Scottsdale",
    "tier": "A"
  },
  {
    "firstName": "Kristin",
    "lastName": "Nelson",
    "fullName": "Kristin Nelson",
    "email": "listinkristin@gmail.com",
    "phone": "",
    "brokerage": "HomeSmart",
    "city": "Scottsdale",
    "tier": "A"
  },
  {
    "firstName": "Laura",
    "lastName": "Bastien",
    "fullName": "Laura Bastien",
    "email": "10bastienl@gmail.com",
    "phone": "",
    "brokerage": "My Home Group",
    "city": "Scottsdale",
    "tier": "B"
  },
  {
    "firstName": "Lavonda",
    "lastName": "Hardy",
    "fullName": "Lavonda Hardy",
    "email": "lavonda.hardy@cbrealty.com",
    "phone": "",
    "brokerage": "Coldwell Banker Realty",
    "city": "Scottsdale",
    "tier": "B"
  },
  {
    "firstName": "Lexx",
    "lastName": "Hatch",
    "fullName": "Lexx Hatch",
    "email": "home@calledtoclose.co",
    "phone": "",
    "brokerage": "Keller Williams Sonoran Living",
    "city": "Scottsdale",
    "tier": "B"
  },
  {
    "firstName": "Lisa",
    "lastName": "Groth",
    "fullName": "Lisa Groth",
    "email": "lgrmxprofessionals@gmail.com",
    "phone": "",
    "brokerage": "RE/MAX Fine Properties",
    "city": "Scottsdale",
    "tier": "P"
  },
  {
    "firstName": "Lisa",
    "lastName": "Tessler",
    "fullName": "Lisa Tessler",
    "email": "lisa@tackettteam.com",
    "phone": "",
    "brokerage": "eXp Realty",
    "city": "Scottsdale",
    "tier": "B"
  },
  {
    "firstName": "Lizbeth",
    "lastName": "Munoz",
    "fullName": "Lizbeth Munoz",
    "email": "youragentlizbeth@gmail.com",
    "phone": "",
    "brokerage": "Barrett Real Estate",
    "city": "Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Lori",
    "lastName": "Gray",
    "fullName": "Lori Gray",
    "email": "lorizeegray@kw.com",
    "phone": "",
    "brokerage": "Keller Williams Arizona Realty",
    "city": "Scottsdale",
    "tier": "P"
  },
  {
    "firstName": "Lucia",
    "lastName": "Burns",
    "fullName": "Lucia Burns",
    "email": "soldbylucia@msn.com",
    "phone": "",
    "brokerage": "Fathom Realty",
    "city": "Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Mayra",
    "lastName": "Garcia",
    "fullName": "Mayra Garcia",
    "email": "mayragvrealtor@gmail.com",
    "phone": "",
    "brokerage": "Barrett Real Estate",
    "city": "Scottsdale",
    "tier": "P"
  },
  {
    "firstName": "Meghan",
    "lastName": "Magana",
    "fullName": "Meghan Magana",
    "email": "meg@mamgroupaz.com",
    "phone": "",
    "brokerage": "HomeSmart",
    "city": "Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Michael",
    "lastName": "Stanton",
    "fullName": "Michael Stanton",
    "email": "az.mike@yahoo.com",
    "phone": "",
    "brokerage": "American Associates",
    "city": "Fountain Hills, Scottsdale",
    "tier": "B"
  },
  {
    "firstName": "Michelle",
    "lastName": "Roden",
    "fullName": "Michelle Roden",
    "email": "michelle@barrettre.com",
    "phone": "",
    "brokerage": "Barrett Real Estate",
    "city": "Scottsdale",
    "tier": "B"
  },
  {
    "firstName": "Monica",
    "lastName": "Coker",
    "fullName": "Monica Coker",
    "email": "info@monicacoker.com",
    "phone": "",
    "brokerage": "HomeSmart",
    "city": "Scottsdale",
    "tier": "P"
  },
  {
    "firstName": "Nancy",
    "lastName": "Badani",
    "fullName": "Nancy Badani",
    "email": "realtorarbaugh@gmail.com",
    "phone": "",
    "brokerage": "Precision Real Estate",
    "city": "Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Nate",
    "lastName": "Leidigh",
    "fullName": "Nate Leidigh",
    "email": "nate@browsearizonahomes.com",
    "phone": "",
    "brokerage": "Real Broker",
    "city": "Chandler, Scottsdale",
    "tier": "A"
  },
  {
    "firstName": "Nate",
    "lastName": "Zeune",
    "fullName": "Nate Zeune",
    "email": "zeune.nate@gmail.com",
    "phone": "",
    "brokerage": "eXp Realty",
    "city": "Scottsdale",
    "tier": "A"
  },
  {
    "firstName": "Nick",
    "lastName": "Lawor",
    "fullName": "Nick Lawor",
    "email": "nick@lawlorrealestategroup.com",
    "phone": "",
    "brokerage": "eXp Realty",
    "city": "Scottsdale",
    "tier": "B"
  },
  {
    "firstName": "Nick",
    "lastName": "Wojtysiak",
    "fullName": "Nick Wojtysiak",
    "email": "nick@simplyluxerealty.com",
    "phone": "",
    "brokerage": "SimplyLuxe",
    "city": "Scottsdale",
    "tier": "A"
  },
  {
    "firstName": "Nissa",
    "lastName": "Mazariegos",
    "fullName": "Nissa Mazariegos",
    "email": "nissasellsaz@gmail.com",
    "phone": "",
    "brokerage": "Barrett Real Estate",
    "city": "Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Norm",
    "lastName": "Hampton",
    "fullName": "Norm Hampton",
    "email": "normh@exec-elite.com",
    "phone": "",
    "brokerage": "Realty Executives Arizona Territory",
    "city": "Scottsdale",
    "tier": "A"
  },
  {
    "firstName": "Rick",
    "lastName": "Nichols",
    "fullName": "Rick Nichols",
    "email": "ricknicholsrealtor@gmail.com",
    "phone": "",
    "brokerage": "HomeSmart",
    "city": "Scottsdale",
    "tier": "B"
  },
  {
    "firstName": "Rick",
    "lastName": "Wells",
    "fullName": "Rick Wells",
    "email": "rickwells101@live.com",
    "phone": "",
    "brokerage": "HomeSmart",
    "city": "Scottsdale",
    "tier": "B"
  },
  {
    "firstName": "Rigby",
    "lastName": "Cilley",
    "fullName": "Rigby Cilley",
    "email": "rigbycilley@gmail.com",
    "phone": "",
    "brokerage": "Realty Executives Arizona Territory",
    "city": "Scottsdale",
    "tier": "A"
  },
  {
    "firstName": "Riley",
    "lastName": "Cilley",
    "fullName": "Riley Cilley",
    "email": "rileycilley@gmail.com",
    "phone": "",
    "brokerage": "Realty Executives Arizona Territory",
    "city": "Scottsdale",
    "tier": "A"
  },
  {
    "firstName": "Rui",
    "lastName": "Barros",
    "fullName": "Rui Barros",
    "email": "ruibarrosaz@gmail.com",
    "phone": "",
    "brokerage": "HomeSmart",
    "city": "McCormick Ranch, Scottsdale",
    "tier": "B"
  },
  {
    "firstName": "Sady",
    "lastName": "Flynn",
    "fullName": "Sady Flynn",
    "email": "sadyf443@gmail.com",
    "phone": "",
    "brokerage": "My Home Group",
    "city": "Scottsdale",
    "tier": "B"
  },
  {
    "firstName": "Shannon",
    "lastName": "Seidl",
    "fullName": "Shannon Seidl",
    "email": "shannon@reallyre.com",
    "phone": "",
    "brokerage": "Barrett Real Estate",
    "city": "Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Sherri",
    "lastName": "Plotke",
    "fullName": "Sherri Plotke",
    "email": "sherri@azgolfandsunproperties.com",
    "phone": "",
    "brokerage": "Arizona Golf & Sun Properties",
    "city": "Scottsdale",
    "tier": "P"
  },
  {
    "firstName": "Sherrie",
    "lastName": "Travers",
    "fullName": "Sherrie Travers",
    "email": "sherrie@karlisenburg.com",
    "phone": "",
    "brokerage": "eXp Realty",
    "city": "Scottsdale",
    "tier": "P"
  },
  {
    "firstName": "Stephanie",
    "lastName": "Taylor",
    "fullName": "Stephanie Taylor",
    "email": "keyswithstephanie@gmail.com",
    "phone": "",
    "brokerage": "Barrett Real Estate",
    "city": "Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Tara",
    "lastName": "Riley",
    "fullName": "Tara Riley",
    "email": "tara.riley@bhhsaz.com",
    "phone": "",
    "brokerage": "Berkshire Hathaway HomeServices Arizona Properties",
    "city": "Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Teresa",
    "lastName": "Capista",
    "fullName": "Teresa Capista",
    "email": "teresa@nelsongroupsw.com",
    "phone": "",
    "brokerage": "Compass",
    "city": "Scottsdale",
    "tier": "P"
  },
  {
    "firstName": "Tyler",
    "lastName": "Johnston",
    "fullName": "Tyler Johnston",
    "email": "yourrealtortylerjohnston@gmail.com",
    "phone": "",
    "brokerage": "Barrett Real Estate",
    "city": "Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Vicki",
    "lastName": "Potolicchio",
    "fullName": "Vicki Potolicchio",
    "email": "vickiazrealestate@gmail.com",
    "phone": "",
    "brokerage": "HomeSmart",
    "city": "Scottsdale",
    "tier": "P"
  },
  {
    "firstName": "Vince",
    "lastName": "Zerilli",
    "fullName": "Vince Zerilli",
    "email": "realtorvz@gmail.com",
    "phone": "",
    "brokerage": "West USA",
    "city": "Scottsdale",
    "tier": "A"
  },
  {
    "firstName": "Virginia",
    "lastName": "Braden",
    "fullName": "Virginia Braden",
    "email": "vbraden@barrettre.com",
    "phone": "",
    "brokerage": "Barrett Real Estate",
    "city": "Scottsdale",
    "tier": "B"
  },
  {
    "firstName": "Waliece",
    "lastName": "Anderson",
    "fullName": "Waliece Anderson",
    "email": "waliece@msn.com",
    "phone": "",
    "brokerage": "Barrett Real Estate",
    "city": "Scottsdale",
    "tier": "C"
  },
  {
    "firstName": "Wendy",
    "lastName": "Anderson",
    "fullName": "Wendy Anderson",
    "email": "wanderson@hsmove.com",
    "phone": "",
    "brokerage": "HomeSmart",
    "city": "Scottsdale",
    "tier": "C"
  }
]
$contacts$::jsonb) as x(
    "firstName" text, "lastName" text, "fullName" text,
    email text, phone text, brokerage text, city text, tier text
  )
)
-- full_name is a generated column (first_name || ' ' || last_name); never inserted.
insert into public.contacts (
  account_id, user_id, first_name, last_name,
  email, phone, brokerage, city, tier, type, stage, source
)
select
  acct.account_id, acct.user_id,
  src."firstName", src."lastName",
  lower(src.email),
  nullif(src.phone, ''),
  nullif(src.brokerage, ''),
  nullif(src.city, ''),
  src.tier,
  'realtor', 'new', 'obsidian-consolidation'
from src cross join acct
on conflict (email) do update set
  first_name = excluded.first_name,
  last_name  = excluded.last_name,
  phone      = coalesce(nullif(excluded.phone, ''), public.contacts.phone),
  brokerage  = coalesce(nullif(excluded.brokerage, ''), public.contacts.brokerage),
  city       = coalesce(nullif(excluded.city, ''), public.contacts.city),
  tier       = excluded.tier,
  updated_at = now();
