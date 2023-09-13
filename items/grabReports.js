const axios = require("axios");
const isGuidOrganisation = require("../utils/isGuidOrganisation");
async function grabReports(BaseXContract) {
	const itemsContract = await BaseXContract.getItems();
	const reports = await Promise.all(
		itemsContract.map(async (contractItem) => {
			const ipfsHash = contractItem.JSONIPFS.replace("/ipfs/", "");
			const isOrgTarget = await isGuidOrganisation(
				BaseXContract,
				contractItem.targetGuid
			);
			if (!isOrgTarget) {
				return false;
			}
			return axios
				.get(`https://ipfs.kleros.io/ipfs/${ipfsHash}`)
				.then((response) => {
					const reportData = response.data.values;

					const newReport = {
						organisationGUID: contractItem.targetGuid,
						title: `${reportData.Title}`,
						comments: reportData.Comments,
						uploadDate: new Date(reportData["Start Date"]),
						accountingPeriodStart: new Date(reportData["Start Date"]),
						accountingPeriodEnd: new Date(reportData["End Date"]),
						source: reportData.Source,
						ipfs: reportData.Report,
						reportGUID: contractItem.itemGuid,
					};
					return newReport;
				});
		})
	);
	return reports.filter((x) => x);
}
module.exports = grabReports;
