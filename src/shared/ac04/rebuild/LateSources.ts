/**
 * Late-campaign (M13-M18) reference digests. These are transcriptions and
 * coordinate conversions of inspected references, never copied assets, and
 * never treated as Normal unit-count evidence where the source is Ace-only.
 */
export const LateSourceUrls = {
	wiki13: "https://acecombat.wiki.gg/wiki/Safe_Return",
	wiki14: "https://acecombat.wiki.gg/wiki/Breaking_Arrows",
	wiki15: "https://acecombat.wiki.gg/wiki/Emancipation",
	wiki16: "https://acecombat.wiki.gg/wiki/Whiskey_Corridor_(mission)",
	wiki17: "https://acecombat.wiki.gg/wiki/Siege_of_Farbanti",
	wiki18: "https://acecombat.wiki.gg/wiki/Megalith_(mission)",
	/** Direct GameFAQs returns 403; the 2023 Wayback copy of the same guide was read. */
	gamefaqs: "https://gamefaqs.gamespot.com/ps2/452838-ace-combat-04-shattered-skies/faqs/48109",
	gamefaqsArchive: "https://web.archive.org/web/2023/https://gamefaqs.gamespot.com/ps2/452838-ace-combat-04-shattered-skies/faqs/48109",
	mitoro: (id: number) => `https://mitoro.sakura.ne.jp/ac04/data/m${id}.htm`,
	mitoroM13Detail: "https://mitoro.sakura.ne.jp/ac04/data/ac04_m13d2.gif",
	mitoroM15Map: "https://mitoro.sakura.ne.jp/ac04/data/img/m15_01.png",
	mitoroM17Detail: "https://mitoro.sakura.ne.jp/ac04/data/ac04_m17d2.gif",
	mitoroM18Structure: "https://mitoro.sakura.ne.jp/ac04/data/ac04_m18d2.gif",
	mitoroM18Route: "https://mitoro.sakura.ne.jp/ac04/data/ac04_m18d3.gif",
};

/**
 * Mitoro M13 jammer detail map (Ace difficulty, 157 jammers): [pixelX, pixelY,
 * altitudeMetres] read from the 1761x671 labelled image. The grid in that image
 * is 220 px per overview cell, so the overview map is the detail scaled by
 * ~3.144 horizontally and ~3.2 vertically, starting at overview row ~209.
 * Pixel transcription by eye: positions are approximate to a few pixels and a
 * handful of overlapping labels may be misread. The Normal population is NOT
 * 157; see `lateSafeReturnJammers`.
 */
export const LateM13JammerDetail: number[][] = [
	[130,212,1300],[255,188,1800],[120,247,1400],[323,265,1960],[389,220,1880],[172,293,1360],[410,275,1640],[466,306,1900],
	[135,423,1360],[212,406,1280],[272,396,1880],[448,355,1980],[260,450,1200],[400,434,2000],[507,380,1420],[337,486,1800],
	[108,528,270],[209,515,1580],[241,568,1780],[379,568,1220],[452,493,1600],[545,423,940],
	[572,170,1340],[604,174,350],[630,160,360],[565,196,610],[630,187,810],[620,204,1200],[675,183,1280],[582,220,980],
	[612,247,160],[565,260,1660],[625,260,1600],[612,280,700],[656,213,500],[716,200,840],[703,253,700],[725,276,990],
	[706,300,800],[785,325,2000],[657,352,1260],[647,408,1640],[762,409,1600],[523,488,1040],[567,470,520],[630,475,560],
	[658,472,1000],[540,504,1400],[580,513,1200],[655,493,800],[630,503,700],[712,470,2200],[600,531,1360],[585,548,240],
	[636,551,690],[598,601,880],[788,445,1700],[818,450,900],[782,488,540],[808,479,1000],[860,489,790],[842,524,1200],
	[782,538,1400],[805,188,1100],[885,195,1120],[910,228,1240],[945,225,560],[993,191,800],[980,221,1400],[1012,225,960],
	[1035,220,1000],[1062,214,580],[970,244,900],[900,256,1030],[937,265,1200],[1035,264,880],[945,300,1200],[940,338,1000],
	[928,355,700],[1013,355,480],[1038,355,800],[1020,368,590],[1078,381,580],[1102,392,940],[1043,401,1200],[935,397,1000],
	[1020,409,700],[960,423,1360],[1043,444,1380],[930,451,800],[938,476,800],[925,492,960],[902,514,500],[1032,527,1400],
	[927,562,1000],[940,599,1000],[1035,606,740],[935,620,1300],[1122,220,1260],[1193,203,1700],[1218,220,1560],[1172,267,1960],
	[1233,267,2000],[1205,360,1940],[1250,408,1800],[1138,470,700],[1186,509,1140],[1276,509,980],[1236,606,800],[1293,616,1700],
	[1296,594,920],[1262,158,1500],[1245,171,1380],[1278,168,1580],[1308,154,800],[1298,215,1920],[1322,199,1460],[1335,211,650],
	[1380,192,1140],[1355,212,1160],[1378,224,1080],[1422,141,1430],[1418,203,1380],[1497,208,1640],[1358,242,1400],[1430,253,780],
	[1468,245,1190],[1567,195,1940],[1626,234,1760],[1683,222,1910],[1376,288,680],[1403,280,1240],[1408,292,710],[1455,281,330],
	[1543,278,1800],[1440,315,1530],[1466,352,1120],[1478,368,1000],[1475,392,910],[1400,383,2000],[1386,409,1540],[1593,350,1460],
	[1683,359,900],[1318,461,1700],[1402,472,320],[1458,474,520],[1473,483,1270],[1460,491,1600],[1382,486,1200],[1311,494,880],
	[1462,449,1480],[1645,430,980],[1663,479,800],[1586,507,1400],[1518,552,1080],[1645,603,320],
];
/** The detail map labels one hidden ship ("駆逐艦", destroyer) at this pixel. Wiki calls it a frigate. */
export const LateM13ShipPixel: number[] = [1472, 317];

/** Overview-map scale used throughout the late rebuild: 13 studs per 560-px map pixel. */
export const LATE_STUDS_PER_MAP_PIXEL = 13;
/** Converts the M13 detail-map pixel to world studs (north = -Z). */
export function lateM13DetailToWorld(px: number, py: number): [number, number] {
	const overviewX = px / 3.144, overviewY = 209 + py / 3.2;
	return [(overviewX - 280) * LATE_STUDS_PER_MAP_PIXEL, (overviewY - 280) * LATE_STUDS_PER_MAP_PIXEL];
}
/** Altitude adaptation: metres above the source datum -> studs above the land datum. */
export function lateM13AltitudeToY(metres: number): number { return 64 + 60 + metres * 0.36; }

/**
 * Deterministic Normal subset: evenly decimates the column-ordered Ace field to
 * `count` jammers, preserving the source's spatial density (including the
 * middle-right congregation the Normal walkthrough mentions). The subset is an
 * explicit adaptation; Normal jammer positions are not published.
 */
export function lateSafeReturnJammers(count: number): number[][] {
	const source = LateM13JammerDetail, out: number[][] = [];
	const n = source.size(), take = math.min(count, n);
	for (let i = 0; i < take; i++) out.push(source[math.floor(i * n / take)]);
	// Larger hypothetical populations (115) reuse the field with a deterministic
	// offset; they never exceed the authored source density by more than one.
	for (let i = take; i < count; i++) {
		const base = source[math.floor((i - take) * n / math.max(1, count - take)) % n];
		out.push([base[0] + 18, base[1] + 14, math.max(200, base[2] - 260)]);
	}
	return out;
}

/** Evidence statements reused by the campaign notes and the review report. */
export const LateEvidence = {
	m13: "Wiki: 7:00 first phase, 13 jammers/1300 to advance, radar lock denied, hidden frigate on an eastern N-S river; update 15:00 with 2 F-15E + 2 EF-2000 (240). Shotgunnova Normal (archived): fog-ridden mountains, U-2 enters from the north, balloons dense middle-right, update fighters inbound to the eastern canyon. Mitoro Ace: 157 jammers 0-2200 m, jammers respawn (condition unknown), update fighters appear just north of the player.",
	m14: "Wiki: 20:00; wave 1 (5) near the start flying south; wave 2 (10) at north edge after some wave-1 kills, splits into two groups of five when attacked; final evasive missile after all earlier missiles with two F-22; XB-70 table 120 vs prose 200; S 2020. Shotgunnova Normal: final missile stays along the eastern edge of the glacier; S = all missiles + both escorts + XB-70 = 2020 (arithmetically requires XB-70 200). Mitoro Ace: XB-70 on a fixed northern line, flees north when wave 2 is annihilated; F-22s appear when the final missile reaches a point, 5 miles north of the player.",
	m15: "Wiki: New City west, Old Towne east, San Profetta Airport north; launchers SW of New City and NE of Old Towne; Yellow retreats invulnerably after four losses; six Tu-160 update. Shotgunnova Normal: Gov't complex high-rises with Ka-50 between towers, airport C-17s with one central SAM, Old Towne lit highways and an Arc-de-Triomphe-like monument, launchers by the west coast; Tu-160 pairs from the west border middle on a west-to-east flight plan over the three clusters at ~7500 ft; map ~4/7 normal size. Mitoro Ace: triangular combat area, respawning fighters per cluster.",
	m16: "Wiki: corridor between Lambert and Amber Mountains, three main lines, pillboxes on the westernmost link, HQ in the northernmost sector, artillery SE of HQ, SR-71 at the SW corner at 20,000 ft, 3500/20:00, S 6300. Shotgunnova Normal: start SE; Old Anchor Point city (thin tank spread, ~1250 pts), central line (~1500 pts, 2-3 unit clumps), western defensive position (two minor clusters, one with tents, pillboxes), northern line on a salt flat with tents, flak and HQ. Mitoro Ace: clearing one group reveals a nearby group; F-2 over a crater; respawning aircraft.",
	m17: "Wiki: GHQ beneath a coastal landfill; allies enter via Silver Bridge (SE) and the flooded city (S); enemy tanks approach from the north and Johnson Memorial Bridge must be destroyed; V-22 in the last two minutes; 55 ground (2530) and four ships (580); Yellow update 18:00. Shotgunnova Normal: compact map; two bridges, Johnson destructible and stops southward tanks; submerged municipal area on the western coast with submarines and helicopters among old skyscrapers. Mitoro Ace: destroying the bridge kills two tanks on it; a destroyer near the bridge; reinforcement formations chain on clearance; ground reinforcements appear in the centre.",
	m18: "Wiki: three large tunnels (west/east/north axes) each with a generator, a smaller central tunnel opening after all generators, six zero-point launch ports along the large tunnels, 15 Yellows at 90, core 990, escape by pulling up through the exit hatch; leaving before the core launches it and fails. Shotgunnova Normal (archived diagram): E-W duct beneath the two N-S tunnels, locked central N-S tunnel, windows to climb out of the low duct, missiles 300, exit through the opening silo roof. Mitoro Ace structure/route diagrams: north E-W bar, two long southern arms with three ports each, shorter central tube, generators west-arm/bar-centre/east-arm, four large secondary missiles exposed on the bar, central vertical exit whose ceiling opens after the core.",
};
