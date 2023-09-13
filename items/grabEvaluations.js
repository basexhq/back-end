const axios = require("axios");
const isGuidOrganisation = require("../utils/isGuidOrganisation");
async function grabEvaluations(BaseXContract) {
	const itemsContract = await BaseXContract.getItems();
	const evaluations = await Promise.all(
		itemsContract.map(async (contractItem) => {
			const ipfsHash = contractItem.JSONIPFS.replace("/ipfs/", "");
			const isOrgTarget = await isGuidOrganisation(
				BaseXContract,
				contractItem.targetGuid
			);
			if (isOrgTarget) {
				return false;
			}
			return axios
				.get(`https://ipfs.kleros.io/ipfs/${ipfsHash}`)
				.then((response) => {
					const evalData = response.data.values;

					const newEvaluation = {
						organisationGUID: "",
						GUID: `${evalData.GUID}`,
						title: `${evalData.Title}`,
						evaluationContent: {
							comments: evalData.Comments,
							planetJustifications: [],
						},
						pvt: Number(evalData["Positive Value"] ?? 0),
						nvt: Number(evalData["Negative Value"] ?? 0),
						uploadDate: new Date(evalData["Start Date"]),
						accountingPeriodStart: new Date(evalData["Start Date"]),
						accountingPeriodEnd: new Date(evalData["End Date"]),
						targetGUID: contractItem.targetGuid,
					};
					for (let i = 1; i <= 17; i++) {
						const sdgValueKey = `SDG${i} Value`;
						const sdgCommentKey = `SDG${i} Comment`;

						if (evalData[sdgValueKey] || evalData[sdgCommentKey]) {
							newEvaluation.evaluationContent.planetJustifications.push({
								comment: evalData[sdgCommentKey],
								percentage: parseFloat(evalData[sdgValueKey]),
								planetImage: `/img/sdg${i}.png`,
							});
						}
					}
					return newEvaluation;
				});
		})
	);
	return evaluations.filter((x) => x);
}
module.exports = grabEvaluations;
