// New Zealand Regions and Major Areas
export const NZ_REGIONS = [
  {
    region: "Northland",
    areas: ["Whangarei", "Kerikeri", "Kaitaia", "Dargaville", "Paihia"]
  },
  {
    region: "Auckland",
    areas: [
      "Auckland CBD",
      "North Shore",
      "Manukau",
      "Waitakere",
      "Papakura",
      "Franklin",
      "Rodney"
    ]
  },
  {
    region: "Waikato",
    areas: ["Hamilton", "Cambridge", "Te Awamutu", "Tokoroa", "Taupo", "Thames"]
  },
  {
    region: "Bay of Plenty",
    areas: ["Tauranga", "Rotorua", "Whakatane", "Opotiki"]
  },
  {
    region: "Gisborne",
    areas: ["Gisborne"]
  },
  {
    region: "Hawke's Bay",
    areas: ["Napier", "Hastings", "Wairoa"]
  },
  {
    region: "Taranaki",
    areas: ["New Plymouth", "Stratford", "Hawera"]
  },
  {
    region: "Manawatu-Whanganui",
    areas: ["Palmerston North", "Whanganui", "Feilding", "Levin"]
  },
  {
    region: "Wellington",
    areas: [
      "Wellington CBD",
      "Lower Hutt",
      "Upper Hutt",
      "Porirua",
      "Kapiti Coast",
      "Wairarapa"
    ]
  },
  {
    region: "Tasman",
    areas: ["Nelson", "Richmond", "Motueka"]
  },
  {
    region: "Marlborough",
    areas: ["Blenheim", "Picton"]
  },
  {
    region: "West Coast",
    areas: ["Greymouth", "Hokitika", "Westport"]
  },
  {
    region: "Canterbury",
    areas: [
      "Christchurch",
      "Timaru",
      "Ashburton",
      "Rangiora",
      "Kaiapoi",
      "Rolleston"
    ]
  },
  {
    region: "Otago",
    areas: ["Dunedin", "Queenstown", "Wanaka", "Oamaru", "Alexandra"]
  },
  {
    region: "Southland",
    areas: ["Invercargill", "Gore"]
  }
];

// Flatten for easy dropdown usage
export const getAllAreas = () => {
  return NZ_REGIONS.flatMap(r => 
    r.areas.map(area => ({ region: r.region, area }))
  );
};

export const getAreasByRegion = (region: string) => {
  const found = NZ_REGIONS.find(r => r.region === region);
  return found ? found.areas : [];
};
