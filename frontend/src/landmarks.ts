export type LandmarkKind = 'taj' | 'gate' | 'tower' | 'palace' | 'minaret' | 'temple'

export type MaterialSpec = { name: string; colour: string; note: string }

export type Landmark = {
  id: string
  name: string
  city: string
  state: string
  lat: number
  lng: number
  kind: LandmarkKind
  built: string
  architect: string
  unesco?: boolean
  summary: string
  history: string[]
  materials: MaterialSpec[]
  concepts: { name: string; note: string }[]
  artifacts: { name: string; note: string }[]
  images: { src: string; caption: string }[]
}

export const LANDMARKS: Landmark[] = [
  {
    id: 'taj-mahal',
    name: 'Taj Mahal',
    city: 'Agra',
    state: 'Uttar Pradesh',
    lat: 27.1751,
    lng: 78.0421,
    kind: 'taj',
    built: '1632–1653 CE',
    architect: 'Ustad Ahmad Lahauri (chief architect)',
    unesco: true,
    summary:
      'A white-marble mausoleum built by the Mughal emperor Shah Jahan for his wife Mumtaz Mahal, set in a formal charbagh garden on the Yamuna river.',
    history: [
      'Commissioned in 1632, a year after Mumtaz Mahal died in Burhanpur during childbirth; the complex took about 22 years and roughly 20,000 artisans to complete.',
      'The mausoleum is the focal point of a 17-hectare charbagh (four-part paradise garden) aligned on the riverfront, with a mosque and a jawab (answer) building flanking it.',
      'The cenotaphs inside are decorative; the actual graves lie in a crypt below, closed to visitors.',
      'Designated a UNESCO World Heritage Site in 1983 and one of the New Seven Wonders of the World in 2007.',
      'Air pollution discolouration led to periodic mud-pack cleaning of the marble facade and a wider air-quality management plan around Agra.',
    ],
    materials: [
      { name: 'Makrana white marble', colour: '#f1ebdf', note: 'Quarried in Rajasthan; the translucent cladding of the mausoleum.' },
      { name: 'Pietra dura (parchin kari)', colour: '#b6412f', note: 'Inlaid semi-precious stones — jasper, jade, lapis lazuli, turquoise, carnelian.' },
      { name: 'Red sandstone', colour: '#a94f36', note: 'Mosque, jawab and gateway; contrasts with the marble mausoleum.' },
      { name: 'Gold leaf finial', colour: '#d8aa3f', note: 'The spire above the dome, traditionally attributed to a gilded copper finial.' },
    ],
    concepts: [
      { name: 'Charbagh symmetry', note: 'Four-part garden divided by water channels, representing paradise in Mughal cosmology.' },
      { name: 'Double dome', note: 'An inner ceiling and a taller outer dome create a monumental profile with a human-scaled interior volume.' },
      { name: 'Optical correction', note: 'Minarets lean slightly outward so they read vertical from a distance and would fall away from the tomb if toppled.' },
      { name: 'Hasht-bihisht plan', note: 'Eight-paradise layout: a central chamber ringed by eight rooms.' },
      { name: 'Scaled calligraphy', note: 'Quranic verses around the arches grow larger higher up to appear uniform from below.' },
    ],
    artifacts: [
      { name: 'Marble jali screens', note: 'Pierced marble lattices around the cenotaphs, cut from single slabs.' },
      { name: 'Cenotaphs', note: 'Inlaid marble markers over the crypt; Mumtaz Mahal’s is centrally placed.' },
      { name: 'Calligraphic panels', note: 'Verses by the calligrapher Amanat Khan in black stone inlay.' },
      { name: 'Reflecting pool', note: 'The raised water channel that mirrors the mausoleum on the garden axis.' },
    ],
    images: [
      { src: 'landmarks/taj-exterior.jpg', caption: 'Mausoleum on the garden axis at golden hour (AI illustration)' },
      { src: 'landmarks/taj-inlay.jpg', caption: 'Pietra dura inlay detail on Makrana marble (AI illustration)' },
      { src: 'landmarks/taj-interior.jpg', caption: 'Interior arch and dome volume (AI illustration)' },
    ],
  },
  {
    id: 'india-gate',
    name: 'India Gate',
    city: 'New Delhi',
    state: 'Delhi',
    lat: 28.6129,
    lng: 77.2295,
    kind: 'gate',
    built: '1921–1931',
    architect: 'Sir Edwin Lutyens',
    summary:
      'A 42-metre stone war memorial arch on the Rajpath axis, commemorating soldiers of the British Indian Army who died in the First World War.',
    history: [
      'Foundation stone laid in 1921; the memorial was unveiled in 1931 as the All India War Memorial.',
      'Around 13,000 names of Indian and British soldiers are inscribed on the monument, with the word INDIA on the arch.',
      'The Amar Jawan Jyoti flame, added in 1972, burned beneath the arch until it was merged with the National War Memorial flame in 2022.',
      'The surrounding India Gate hexagon is a major public gathering space and the focal point of the Central Vista redevelopment.',
    ],
    materials: [
      { name: 'Bharatpur stone', colour: '#c9b79a', note: 'Warm sandstone facing, chosen to match Lutyens’s Delhi palette.' },
      { name: 'Granite', colour: '#6c7276', note: 'Plinth and structural base.' },
      { name: 'Bronze', colour: '#7a6a45', note: 'Lettering and memorial fittings.' },
    ],
    concepts: [
      { name: 'Imperial axis', note: 'Centred on the Rajpath vista from Rashtrapati Bhavan — a Lutyens–Baker plan device.' },
      { name: 'Triumphal arch typology', note: 'A single monumental opening scaled for ceremonial procession rather than defence.' },
      { name: 'Memorial landscape', note: 'The hexagon and lawns turn a monument into a public urban room.' },
    ],
    artifacts: [
      { name: 'Name inscriptions', note: 'Over 13,000 names carved into the stone.' },
      { name: 'Amar Jawan Jyoti', note: 'The eternal flame memorial to fallen soldiers.' },
      { name: 'Canopy', note: 'The empty baldachin nearby that once held a statue of George V.' },
    ],
    images: [],
  },
  {
    id: 'gateway-of-india',
    name: 'Gateway of India',
    city: 'Mumbai',
    state: 'Maharashtra',
    lat: 18.9217,
    lng: 72.8347,
    kind: 'gate',
    built: '1911–1924',
    architect: 'George Wittet',
    summary:
      'A basalt arch on the Mumbai waterfront built to commemorate the 1911 royal visit, later the ceremonial exit point for the last British troops in 1948.',
    history: [
      'Built to mark the landing of King George V and Queen Mary in 1911; construction ran from 1913 and the gateway opened in 1924.',
      'The last British troops left India through this arch in February 1948, making it a symbol of independence.',
      'Indo-Saracenic detailing combines Hindu and Muslim architectural motifs with a European triumphal arch.',
    ],
    materials: [
      { name: 'Yellow basalt', colour: '#b29a5f', note: 'Local stone cladding for the arch and turrets.' },
      { name: 'Reinforced concrete', colour: '#8d8f8c', note: 'Early structural concrete core, unusual for its date.' },
    ],
    concepts: [
      { name: 'Indo-Saracenic', note: 'A colonial synthesis of Indian detailing with European planning.' },
      { name: 'Harbour gateway', note: 'The arch frames the sea approach, scaling the monument to ships.' },
      { name: 'Ceremonial axis', note: 'Aligned with the Taj Mahal Palace hotel behind it.' },
    ],
    artifacts: [
      { name: 'Commemorative inscription', note: 'Stone tablet recording the 1911 royal landing.' },
      { name: 'Corner turrets', note: 'Four turrets that give the arch its silhouette.' },
    ],
    images: [],
  },
  {
    id: 'charminar',
    name: 'Charminar',
    city: 'Hyderabad',
    state: 'Telangana',
    lat: 17.3616,
    lng: 78.4747,
    kind: 'tower',
    built: '1591 CE',
    architect: 'Commissioned by Muhammad Quli Qutb Shah',
    unesco: true,
    summary:
      'A four-minaret monument at the crossing of Hyderabad’s historic bazaars, built to mark the founding of the city.',
    history: [
      'Completed in 1591, the year Hyderabad was founded, at the intersection of the road to Golconda and the Musi river crossing.',
      'A mosque occupies the upper storey; the four minarets rise about 56 metres and were designed as landmarks visible across the city.',
      'The surrounding Laad Bazaar and pearl market grew around the monument, which remains the city’s ceremonial centre.',
    ],
    materials: [
      { name: 'Granite', colour: '#8a8f92', note: 'Load-bearing stone for the piers and minarets.' },
      { name: 'Lime mortar plaster', colour: '#d8cdb8', note: 'Historic lime plaster finish, periodically renewed.' },
    ],
    concepts: [
      { name: 'Four-way urban gate', note: 'An arch on each face opens onto a different historic bazaar street.' },
      { name: 'Minaret as landmark', note: 'Vertical markers readable across a dense low-rise city.' },
      { name: 'Mosque above a crossing', note: 'Worship stacked over commerce at the city’s central junction.' },
    ],
    artifacts: [
      { name: 'Upper-storey mosque', note: 'A small prayer hall with a courtyard facing Mecca.' },
      { name: 'Clock on the western arch', note: 'A later addition to the monument.' },
      { name: 'Laad Bazaar', note: 'The bangle market that frames the monument.' },
    ],
    images: [],
  },
  {
    id: 'hawa-mahal',
    name: 'Hawa Mahal',
    city: 'Jaipur',
    state: 'Rajasthan',
    lat: 26.9239,
    lng: 75.8267,
    kind: 'palace',
    built: '1799 CE',
    architect: 'Lal Chand Ustad',
    summary:
      'The “Palace of Winds”: a five-storey pink-sandstone screen with 953 jharokhas built so royal women could observe the street unseen.',
    history: [
      'Built in 1799 by Maharaja Sawai Pratap Singh as an extension of the City Palace, facing the main bazaar.',
      'Its honeycomb of small windows creates a Venturi effect, drawing breezes through the building in Jaipur’s hot climate.',
      'The facade is a thin screen rather than a full palace block, with ramps instead of stairs connecting the levels.',
    ],
    materials: [
      { name: 'Pink sandstone', colour: '#d98b74', note: 'The Jaipur “pink city” stone of the facade.' },
      { name: 'Lime plaster', colour: '#e6c9ba', note: 'Historic surface finish and pigment.' },
      { name: 'Sandstone lattice', colour: '#c47a63', note: 'Carved jali screens behind the jharokhas.' },
    ],
    concepts: [
      { name: 'Jharokha screen', note: 'Projecting lattice windows that permit view without being seen.' },
      { name: 'Passive cooling', note: 'Stacked openings and internal channels accelerate airflow.' },
      { name: 'Facade as stage set', note: 'The elevation is a decorated screen, not a load-bearing palace front.' },
    ],
    artifacts: [
      { name: '953 jharokhas', note: 'Individually carved projecting windows across five storeys.' },
      { name: 'Hawa Mandir', note: 'The top-storey pavilion that gives the building its name.' },
      { name: 'Interior ramps', note: 'Sloped circulation in place of staircases.' },
    ],
    images: [],
  },
  {
    id: 'qutub-minar',
    name: 'Qutub Minar',
    city: 'New Delhi',
    state: 'Delhi',
    lat: 28.5245,
    lng: 77.1855,
    kind: 'minaret',
    built: '1199–1220 CE (later repairs)',
    architect: 'Qutb al-Din Aibak; completed by Iltutmish',
    unesco: true,
    summary:
      'A 72.5-metre tapering victory tower of red sandstone and marble, the tallest brick minaret in the world, at the centre of the Qutub complex.',
    history: [
      'Begun around 1199 by Qutb al-Din Aibak after the Ghurid conquest and completed by his successor Iltutmish; the top storey was rebuilt after lightning damage.',
      'Five storeys alternate angular and round fluting, with balconies supported on muqarnas corbels.',
      'The complex includes the Quwwat-ul-Islam mosque and the 4th-century iron pillar, famous for its corrosion resistance.',
      'UNESCO World Heritage Site (1993) as part of the Qutub Minar and its monuments.',
    ],
    materials: [
      { name: 'Red sandstone', colour: '#b1583c', note: 'Main shaft of the lower storeys.' },
      { name: 'White marble', colour: '#eee4d4', note: 'Upper storeys and later repairs under Firoz Shah Tughlaq.' },
      { name: 'Wrought iron', colour: '#4b4e50', note: 'The Chandragupta II iron pillar in the complex.' },
    ],
    concepts: [
      { name: 'Tapering shaft', note: 'Diameter reduces with height, giving stability and an upward optical pull.' },
      { name: 'Muqarnas corbels', note: 'Stalactite-like stone brackets carry the balconies.' },
      { name: 'Fluted geometry', note: 'Alternating round and angular flutes change with each storey.' },
    ],
    artifacts: [
      { name: 'Iron pillar', note: 'A 6-tonne Gupta-era pillar with a Sanskrit inscription.' },
      { name: 'Quwwat-ul-Islam mosque', note: 'Early Indo-Islamic mosque reusing temple spolia.' },
      { name: 'Alai Darwaza', note: 'The domed gateway of the later Alauddin Khalji expansion.' },
    ],
    images: [],
  },
  {
    id: 'mysore-palace',
    name: 'Mysore Palace',
    city: 'Mysuru',
    state: 'Karnataka',
    lat: 12.3052,
    lng: 76.6552,
    kind: 'palace',
    built: '1897–1912',
    architect: 'Henry Irwin',
    summary:
      'The seat of the Wadiyar dynasty, an Indo-Saracenic palace with a 44-metre dome, lit by nearly 100,000 bulbs during Dasara.',
    history: [
      'The old wooden palace burned in 1897; the present building was designed by Henry Irwin and completed in 1912.',
      'It combines Hindu, Muslim, Rajput and Gothic elements, with a durbar hall, a marriage hall and a golden howdah chamber.',
      'The palace is the centre of the ten-day Dasara festival, when it is illuminated and a caparisoned elephant procession sets out.',
    ],
    materials: [
      { name: 'Sandstone and brick', colour: '#c08a63', note: 'Structural walls and cladding.' },
      { name: 'Stained glass', colour: '#3f7d9c', note: 'Imported glazing in the durbar hall.' },
      { name: 'Gold leaf', colour: '#d9ae4b', note: 'Gilding on the central dome and ceremonial fittings.' },
    ],
    concepts: [
      { name: 'Indo-Saracenic', note: 'A deliberately hybrid vocabulary for a princely state capital.' },
      { name: 'Durbar axis', note: 'A ceremonial hall sequence for public audience.' },
      { name: 'Festival lighting', note: 'The facade is designed to be read as a light sculpture.' },
    ],
    artifacts: [
      { name: 'Golden howdah', note: 'The elephant-mounted seat used in the Dasara procession.' },
      { name: 'Durbar hall', note: 'The public audience chamber under the main dome.' },
      { name: 'Wadiyar portraits', note: 'A painted record of the ruling dynasty.' },
    ],
    images: [],
  },
  {
    id: 'golden-temple',
    name: 'Harmandir Sahib',
    city: 'Amritsar',
    state: 'Punjab',
    lat: 31.6200,
    lng: 74.8765,
    kind: 'temple',
    built: '1589 CE (gilded 1830)',
    architect: 'Guru Arjan; rebuilt by Guru Ram Das and later Jassa Singh Ahluwalia',
    summary:
      'The Golden Temple, spiritual centre of Sikhism, set in a sacred tank with gold-covered copper domes and four entrances open to all.',
    history: [
      'Founded in 1589 by Guru Arjan, who installed the Adi Granth here in 1604; the building was repeatedly damaged and rebuilt.',
      'Maharaja Ranjit Singh had the upper storeys covered in gold leaf in the early 19th century, giving the temple its name.',
      'The complex includes the Akal Takht, the langar kitchen serving free meals, and a circumambulatory marble path.',
      'Four entrances on each side symbolise openness to all four cardinal directions and all people.',
    ],
    materials: [
      { name: 'Gold leaf over copper', colour: '#d8a92e', note: 'Dome and upper facade gilding.' },
      { name: 'White marble', colour: '#eee9dd', note: 'Lower walls and the circumambulation path.' },
      { name: 'Water (Amrit Sarovar)', colour: '#20788f', note: 'The sacred tank surrounding the shrine.' },
    ],
    concepts: [
      { name: 'Four entrances', note: 'Open access from every direction, regardless of caste or creed.' },
      { name: 'Langar', note: 'A community kitchen that feeds every visitor free of charge.' },
      { name: 'Shrine in water', note: 'The building is approached by causeway across the tank.' },
    ],
    artifacts: [
      { name: 'Adi Granth', note: 'The Sikh scripture installed in 1604.' },
      { name: 'Akal Takht', note: 'The seat of temporal authority facing the shrine.' },
      { name: 'Gilded domes', note: 'Copper domes sheathed in gold leaf.' },
    ],
    images: [],
  },
]

export const LANDMARK_BY_ID = new Map(LANDMARKS.map((landmark) => [landmark.id, landmark]))
