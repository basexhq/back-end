const ethers = require("ethers");
require("dotenv").config();

// const usdtContractAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
// const provider = new ethers.providers.InfuraProvider(
// 	"mainnet",
// 	process.env.INFURA_KEY
// );

// async function listenForTransfers() {
//   // const provider = new ethers.providers.JsonRpcProvider(ethereumNodeUrl);

//   const usdtContract = new ethers.Contract(
//     usdtContractAddress,
//     [
//       "event Transfer(address indexed from, address indexed to, uint256 value)",
//     ],
//     provider
//   );

//   usdtContract.on("Transfer", (from, to, value, event) => {
//     console.log(`Transfer from ${from} to ${to}, Value: ${value.toString()}`);
//   });
// }

// listenForTransfers()
//   .then(() => console.log("Listening for USDT transfers..."))
//   .catch((error) => console.error("Error:", error));


const ADDRESS = require("./contracts/Adress");
const ABI = require("./contracts/ABI");
const provider2 = new ethers.providers.InfuraProvider(
	"goerli",
	process.env.INFURA_KEY
);

async function listenForTransfers2() {

  const BaseXContract = new ethers.Contract(ADDRESS, 
    [
        "event ItemAdded(string indexed orgGuid, string orgName, string indexed itemGuid, string itemJSONIPFS)"
    ]
    , provider2);


    
  BaseXContract.on("ItemAdded", async (orgGuid, orgName, itemGuid, JSONIPFS, event) => {
    console.log(orgName, JSONIPFS);

    const decodedIndexed1 = await BaseXContract.interface.decodeEventLog(
    "ItemAdded",
    orgGuid
    );
  
      const decodedIndexed2 = await BaseXContract.interface.decodeEventLog(
        "ItemAdded",
        itemGuid
      );
  
      console.log("Decoded Indexed Value 1:", decodedIndexed1);
      console.log("Decoded Indexed Value 2:", decodedIndexed2);

  });

  BaseXContract.on("ItemAdded", (...args) => {
    console.log(args);
  });


}

listenForTransfers2()
  .then(() => console.log("Listening for BaseX (new items)..."))
  .catch((error) => console.error("Error:", error));
