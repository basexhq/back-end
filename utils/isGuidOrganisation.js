const axios = require("axios");

async function isGuidOrganisation(BaseXContract, GUID) {
	const organisationsContract = await BaseXContract.getOrganisations();
	return organisationsContract.some((org) => org.orgGuid === GUID);
}

module.exports = isGuidOrganisation;
