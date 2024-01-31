const sqlite3 = require("sqlite3");
const { planetaryBoundaries } = require("../utils/categoriesEval");

const SQL_query_evaluations = `
  SELECT Items.*, JSONIPFS.json
  FROM Items
  LEFT JOIN Organisations ON Items.targetGuid = Organisations.orgGuid
  LEFT JOIN JSONIPFS ON Items.JSONIPFS = JSONIPFS.ipfs
  WHERE Organisations.orgGuid IS NULL;
`;

const db_prod = new sqlite3.Database("data_prod.sqlite");
const db_staging = new sqlite3.Database("data_staging.sqlite");

const getImageURL = (category, i) => {
	switch (category) {
		case "SDG":
			return `/img/sdgs/sdg${i}.png`;
		case "EBF":
			return `/img/ebfs/ebf-${i}.svg`;
		case "United Planet":
			return `/img/unitedplanet/up${i}.png`;
		case "Planetary Boundaries":
			return "planetary";
		default:
			return "";
	}
};

async function grabEvaluations(staging = false) {
	return new Promise((resolve, reject) => {
		const evaluations = []; // we create array of promises to ensure all items are processed before resolving

		const db = staging ? db_staging : db_prod;
		db.all(SQL_query_evaluations, [], (err, rows) => {
			if (err) {
				console.error(err.message);
				reject(err);
				return;
			}

			const promises = rows.map((row) => {
				return new Promise((resolveRow, rejectRow) => {
					if (!row.json) {
						console.log("Grab evaluations: No JSON for item: " + row.itemGuid);
						resolveRow(null); // Resolve with null for items with no JSON
						return;
					}

					const evalData = JSON.parse(row.json);
					// console.log(evalData);

					const newEvaluation = {
						organisationGUID: "",
						GUID: `${evalData.GUID ?? evalData.guid}`,
						title: `${evalData.Title ?? evalData.title}`,
						evaluationContent: {
							comments: evalData.Comments ?? evalData.comments,
							justifications: {},
						},
						pvt: Number(evalData["Positive Value"] ?? 0),
						nvt: Number(evalData["Negative Value"] ?? 0),
						co2: Number(evalData.CO2 ?? 0),
						h2o: Number(evalData.H2O ?? 0),
						uploadDate: new Date(
							evalData["Upload Date"] ?? evalData["Start Date"]
						),
						accountingPeriodStart: new Date(evalData["Start Date"]),
						accountingPeriodEnd: new Date(evalData["End Date"]),
						targetGUID: evalData["GUID Target"],
					};

					const justificationKeys = Object.keys(evalData).filter((key) =>
						key.match(/(.+?)(\d+)(?: Value| Comment)?/)
					);
					const maxIndices = {};
					justificationKeys.forEach((fullKey) => {
						const match = fullKey.match(/(.+?)(\d+)(?: Value| Comment)?/);
						if (match) {
							const category = match[1];
							const index = Number(match[2]);
							if (!maxIndices[category] || index > maxIndices[category]) {
								maxIndices[`${category}`] = index;
							}
						}
					});

					// Loop through each category and its maximum index
					console.log(evalData);
					Object.keys(maxIndices).forEach((category) => {
						const maxIndex = maxIndices[category];
						const justificationArray =
							newEvaluation.evaluationContent.justifications[category] || [];

						for (let i = 1; i <= maxIndex; i++) {
							const valueKey = `${category}${i} Value`;
							const commentKey = `${category}${i} Comment`;

							if (
								Number(evalData[valueKey] ?? 0) !== 0 ||
								(evalData[commentKey] ?? "") !== ""
							) {
								justificationArray.push({
									percentage: Number(evalData[valueKey] ?? 0),
									comment: evalData[commentKey] ?? "",
									imageURL: getImageURL(category, i),
									planetaryBoundary:
										category === "Planetary Boundaries"
											? planetaryBoundaries[i]
											: "",
								});
							}
						}

						newEvaluation.evaluationContent.justifications[category] =
							justificationArray;
					});
					evaluations.push(newEvaluation);
					resolveRow(newEvaluation);
				});
			});

			Promise.all(promises)
				.then(() => {
					resolve(evaluations.filter((x) => x)); // Some rows that resolved with null (no JSON) are filtered out
				})
				.catch((error) => {
					reject(error);
				});
		});
	});
}

module.exports = { grabEvaluations };
