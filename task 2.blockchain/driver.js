"use strict";

let blindSignatures = require("blind-signatures");
let SpyAgency = require("./spyAgency.js").SpyAgency;

function makeDocument(coverName) {
  return (
    "The bearer of this signed document, " +
    coverName +
    ", has full diplomatic immunity."
  );
}

function blind(msg, n, e) {
  return blindSignatures.blind({
    message: msg,
    N: n,
    E: e,
  });
}

function unblind(blindingFactor, sig, n) {
  return blindSignatures.unblind({
    signed: sig,
    N: n,
    r: blindingFactor,
  });
}

// Initialize the SpyAgency
let agency = new SpyAgency();
let coverNames = [
  "John Doe",
  "Jane Smith",
  "James Bond",
  "Ethan Hunt",
  "Natasha Romanoff",
  "Jason Bourne",
  "Jack Ryan",
  "Sydney Bristow",
  "Harry Hart",
  "George Smiley",
];

// Create documents with the cover names
let documents = coverNames.map(makeDocument);
let blindedDocs = [];
let blindingFactors = [];

// Blind each document
documents.forEach(function (doc, index) {
  let result = blind(doc, agency.n, agency.e);
  let blinded = result.blinded;
  let r = result.r;

  console.log("🔹 Document " + index + ": " + doc);
  console.log("🔹 Blinded: " + blinded + "\n🔹 Blinding Factor: " + r + "\n");

  blindedDocs.push(blinded);
  blindingFactors.push(r);
});

// Submit the blinded documents for signing
agency.signDocument(blindedDocs, function (selected, verifyAndSign) {
  console.log("✅ Selected document number: " + selected);

  let maskedBlindingFactors = blindingFactors.map(function (r, index) {
    return index === selected ? undefined : r;
  });

  let maskedDocuments = documents.map(function (doc, index) {
    return index === selected ? undefined : doc;
  });

  try {
    let signedBlinded = verifyAndSign(maskedBlindingFactors, maskedDocuments);
    let signedDoc = unblind(blindingFactors[selected], signedBlinded, agency.n);

    console.log("\n✅ Document signed successfully!");
    console.log("📜 Original document: " + documents[selected]);
    console.log("🖊 Signature: " + signedDoc);

    // Verify the signature
    let verification = blindSignatures.verify({
      message: documents[selected],
      N: agency.n,
      E: agency.e,
      signed: signedDoc,
    });

    console.log(
      "🔎 Signature verification result: " +
        (verification ? "✅ Valid" : "❌ Invalid")
    );
  } catch (error) {
    console.error("❌ Error during signing: " + error.message);
  }
});
