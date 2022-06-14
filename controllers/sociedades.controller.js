const { response, request } = require('express');
const admin = require("firebase-admin");

/* FireSQL */
const { FireSQL } = require('FireSQL');

// Nombre de la colección
dbNameSociedades = "Sociedades";

/* *** Obtener lista de sociedades *** */
const ctrl_lista = async (pi_req = request, pe_res = response) => {

    // Instancia de firestore
    db = admin.firestore();

    // Referencia a la colección de sociedades
    const provRef = db.collection(dbNameSociedades);

    // Obtener lista de sociedades
    const snapshot = await provRef.get();
    if (snapshot.empty) {
        pe_res.status(400).json({
            e_subrc: 4,
            msg: 'No hay sociedades dadas de alta.'
        });
        return;
    }

    // Enviar los documentos de las sociedades en formato JSON
    pe_res.status(201).json(snapshot.docs.map((doc) => {
        const document = doc.data();
        document.rfc = doc.id;
        return document;
    }));

}

/* *** Obtener sociedad por rfc *** */
const ctrl_infoSociedad = async (pi_req = request, pe_res = response) => {
    // Instancia de firestore
    db = admin.firestore();

    // Obtener id de sociedad de parámetros de la URL
    const id = pi_req.params.rfc;

    // Referencia a la colección de sociedades
    const socRef = db.collection(dbNameSociedades).doc(id);

    // Info de sociedad
    const snap = await socRef.get();

    // Si la sociedad no existe enviar código y msg correspondiente
    if (!snap.exists) {
        return pe_res.status(400).json({
            e_subrc: 4,
            msg: `El documento de sociedad: ${id} solicitado no existe.`,
        });
    }

    // Enviar información del sociedad
    const socJson = snap.data();
    socJson.rfc = snap.id;
    pe_res.status(201).send(socJson);
}

/* *** Crear nueva sociedad *** */
const ctrl_crear = async (pi_req = request, pe_res = response) => {

    // Instancia de firestore
    db = admin.firestore();

    // Obtener información de sociedad a guardar
    const sociedad = pi_req.body;
    const rfc = sociedad.rfc;

    // Eliminar la propiedad RFC que es meramente estructura para el front
    delete sociedad.rfc;

    // Realizar inserción
    try {
        const result = await db.collection(dbNameSociedades).doc(`${rfc}`).set(sociedad);
        pe_res.status(200).json({
            e_subrc: 0,
            msg: `Alta de sociedad exitosa - ${rfc}.`
        });
    } catch (error) {
        pe_res.status(400).json({
            e_subrc: 4,
            msg: `Error al grabar en BD - ${error}`
        });
    }
}

/* *** Actualizar sociedad *** */
const ctrl_actualizar = async (pi_req = request, pe_res = response) => {
    // Instancia de firestore
    db = admin.firestore();

    // Obtener RFC de sociedad de parámetros
    const rfc = pi_req.params.rfc;
    const sociedad = pi_req.body;
    try {
        await db.collection(dbNameSociedades).doc(rfc).set(sociedad, { merge: true })
        pe_res.status(201).json({
            e_subrc: 0,
            msg: `Actualización de sociedad: ${rfc} exitosa.`
        });
    } catch (error) {
        pe_res.status(400).json({
            e_subrc: 4,
            msg: `Error al actualizar en BD: ${rfc} - ${error}`
        });
    }
}

/* *** Eliminar sociedad *** */
const ctrl_eliminar = async (pi_req = request, pe_res = response) => {
    // Instancia de firestore
    db = admin.firestore();
    
    // Obtener id de sociedad de parámetros de URL
    const rfc = pi_req.params.rfc

    try {
        await db.collection(dbNameSociedades).doc(rfc).delete();
        pe_res.status(200).json({
            e_subrc: 0,
            msg: `Sociedad ${rfc} borrada.`
        })
    } catch (error) {
        pe_res.status(400).json({
            e_subrc: 4,
            msg: `Error al eliminar sociedad: ${rfc} - ${error}`
        });
    }
}

/* *** Realizar búsqueda *** */
const ctrl_buscar = async (pi_req = request, pe_res = response) => {
    // You can either query the collections at the root of the database...
    const db = admin.firestore();
    const lv_where = pi_req.body.where;
    // And then just pass that reference to FireSQL
    const fireSQL = new FireSQL(db, { includeId: 'rfc'});
    let result = {};
    if(lv_where == "( __name__ LIKE '%'  )"    ||
       lv_where == "( razonSocial LIKE '%'  )" ||
       lv_where == "( direccion LIKE '%'  )"   ||
       lv_where == "( tipoEmpresa LIKE '%'  )"){
        await fireSQL.query(`SELECT * FROM ${dbNameSociedades}`).then(documents => {
            result = documents
        });
    }else{
        await fireSQL.query(`SELECT * FROM ${dbNameSociedades} where ${lv_where}`).then(documents => {
            result = documents
        });
    }
   

    // Enviar los documentos de las sociedades en formato JSON
    pe_res.status(201).json(result);

}
module.exports = {
    ctrl_lista,
    ctrl_infoSociedad,
    ctrl_crear,
    ctrl_actualizar,
    ctrl_eliminar,
    ctrl_buscar
}