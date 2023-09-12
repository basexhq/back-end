const express = require("express");
const ethers = require("ethers");

// Initialize Express
const app = express();


app.get("/",(req,res)=> {
    res.send("GM!");
})

app.listen(5000, () => {
  console.log("Running on port 5000.");
});

module.exports = app;