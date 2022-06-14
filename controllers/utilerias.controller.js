const { response, request } = require('express');
const admin = require("firebase-admin");

dbNameDominios = "DOMINIOS";

// Obtener Lista de CLientes
const ctrl_infoDominios = async (pi_req = request, pe_res = response) => {

  db = admin.firestore();
  const rfc = pi_req.params.rfc;
  const dmName = pi_req.params.dmName;

  const dmRef = db.collection(rfc).doc(dbNameDominios).collection('LISTA').doc(dmName);
  const snapservices = await dmRef.get();

  if (!snapservices.exists) {
    pe_res.status(400).json({
      e_subrc: 4,
      msg: "El dominio solicitado no existe",
    });
  } else {
    pe_res.send(snapservices.data());
  }
}

module.exports = {
  ctrl_infoDominios
}