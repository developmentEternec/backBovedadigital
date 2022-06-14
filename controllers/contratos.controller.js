const { response, request } = require('express');
const admin = require("firebase-admin");

/* FireSQL */
const { FireSQL } = require('FireSQL');

// Nombre de la colección
dbColCont = "CONTRATOS";
subColHdr = "HDR";
subColDet = "DET";
// Subcolección de posiciones p/manipulación de documentos
subColPosiciones = 'POSICIONES';

/* *** Crear contrato *** */
const ctrl_crear = async (pi_req = request, pe_res = response) => {
    // Instancia de firestore
    db = admin.firestore();

    // Obtener información de proveedor a guardar
    const rfc = pi_req.params.rfc;
    const hdr = pi_req.body.hdr;
    const det = pi_req.body.det;
    console.log(hdr);
    console.log(det);
    // Eliminar propiedad de idContrato
    delete hdr.idContrato;
    delete det.idContrato;

    // Trámitar siguiente consecutivo
    const nextId = await getNextNumber(rfc, 'ID-CONTRATO');
    if (nextId.e_subrc === 0) {
        // Realizar inserción
        try {
            // Insert header
            await db.collection(rfc).doc(dbColCont).set({})
            const resultHdr = await db.collection(rfc).doc(dbColCont).collection(subColHdr)
                .doc(`${nextId.value}`).set(hdr);
            // Insert detail
            await db.collection(rfc).doc(dbColCont).set({});
            await db.collection(rfc).doc(dbColCont).collection(subColDet).doc(`${nextId.value}`).set({});
            for (let posicion in det) {
                await db.collection(rfc).doc(dbColCont).collection(subColDet).doc(`${nextId.value}`).collection(subColPosiciones).doc(posicion).set(det[posicion]);
            }
            return pe_res.status(200).json({
                e_subrc: 0,
                msg: `Alta de contrato exitosa`,
                idContrato: `${nextId.value}`
            });
        } catch (error) {
           
            return pe_res.status(400).json({
                e_subrc: 4,
                msg: `Error al grabar en BD - ${error}`
            });
        }
    } else {
        return pe_res.status(400).json({
            e_subrc: 4,
            msg: `${nextId.msg || 'Error, contactar al administrador.'}`
        });
    }
}

/* *** Eliminar contrato *** */
const ctrl_eliminar = async (pi_req = request, pe_res = response) => {
    // Instancia de firestore
    db = admin.firestore();

    // Obtener id de proveedor de parámetros de URL
    const rfc = pi_req.params.rfc;
    const idContrato = pi_req.params.idContrato;
    const user = pi_req.params.user;

    // Validar que el contrato exista y en caso de, obtener las posiciones para borrarlas posteriormente
    const snapshotHdr = await db.collection(rfc).doc(dbColCont).collection(subColHdr).doc(idContrato).get();
    if (!snapshotHdr.exists) {
        return pe_res.status(400).json({
            e_subrc: 4,
            msg: `No se encontró el contrato: ${idContrato} en BD.`
        });
    }

    // Cambiar estatus
    try {
        const contratoRef = await db.collection(rfc).doc(dbColCont).collection(subColHdr).doc(idContrato);
        await contratoRef.update({ estatus: '01', usuarioEstatus: user, fechaEstatus: getfechaActual() });
        pe_res.status(200).json({
            e_subrc: 0,
            msg: `Contrato: ${idContrato} borrada con éxito.`
        });
    } catch (error) {
        pe_res.status(400).json({
            e_subrc: 4,
            msg: `Ha ocurrido un error al borrar la contrato: ${idContrato} - ${error}`
        });
    }

}

/* *** Actualizar contrato *** */
const ctrl_actualizar = async (pi_req = request, pe_res = response) => {
    // Instancia de firestore
    db = admin.firestore();

    // Obtener información de proveedor a guardar
    const rfc = pi_req.params.rfc;
    const idContrato = pi_req.params.idContrato;
    const hdr = pi_req.body.hdr;
    const det = pi_req.body.det;

    // Eliminar propiedad de idContrato
    delete hdr.idContrato;
    delete det.idContrato;

    // Realizar inserción
    try {
        // Update header
        const resultHdr = await db.collection(rfc).doc(dbColCont).collection(subColHdr).doc(idContrato).set(hdr, { merge: true });
        // Update detail
        for (let posicion in det) {
            await db.collection(rfc).doc(dbColCont)
                .collection(subColDet).doc(idContrato)
                .collection(subColPosiciones).doc(posicion).set(det[posicion], { merge: true });
        }
        return pe_res.status(200).json({
            e_subrc: 0,
            msg: `Actualización de contrato exitosa - ${idContrato}.`
        });
    } catch (error) {
        pe_res.status(400).json({
            e_subrc: 4,
            msg: `Error al actualizar contrato: ${idContrato} en BD - ${error}`
        });
    }
}

/* *** Info contrato *** */
const ctrl_infoContrato = async (pi_req = request, pe_res = response) => {
    // Instancia de firestore
    db = admin.firestore();

    // Obtener id de proveedor de parámetros de URL
    const rfc = pi_req.params.rfc;
    const idContrato = pi_req.params.idContrato;

    // Validar que el contrato exista y en caso de, obtener las posiciones para borrarlas posteriormente
    const snapshotHdr = await db.collection(rfc).doc(dbColCont).collection(subColHdr).doc(idContrato).get();

    // Info header
    let hdr = snapshotHdr.data();

    // Info detail
    let det = {};
    let cont = 0;

    let snapshotDet;
    if (!snapshotHdr.exists) {
        return pe_res.status(400).json({
            e_subrc: 4,
            msg: `No se encontró el contrato: ${idContrato} en BD.`
        });
    } else {
        // Se setea idContrato
        hdr.idContrato = snapshotHdr.id;
        // Se obtiene el detalle
        snapshotDet = await db.collection(rfc).doc(dbColCont).collection(subColDet).doc(idContrato).collection(subColPosiciones).get();
        snapshotDet.forEach((doc) => {
            const document = doc.data();
            document.idPosnr = doc.id;
            det[cont] = document;
            cont++
        });
    }

    pe_res.status(200).json({
        e_subrc: 0,
        contrato: {
            hdr,
            det
        }
    })
}

/* *** Lista contratos HDR *** */
const ctrl_lista = async (pi_req = request, pe_res = response) => {
    const rfc = pi_req.params.rfc;
    // Referencia a Firebase
    db = admin.firestore().collection(rfc).doc(dbColCont);
    let result = {};

    // And then just pass that reference to FireSQL
    const fireSQL = new FireSQL(db, { includeId: 'idContrato' });
    await fireSQL.query(`SELECT * FROM HDR where estatus != '01'`).then(documents => {
        result = documents
    });

    // Validar respuesta
    if (result.length === 0) {
        // Enviar los documentos de las facturas HDR en formato JSON
        pe_res.status(400).json({
            e_subrc: 4,
            msg: 'No hay contratos.'
        });
    } else {
        // Enviar los documentos de las facturas HDR en formato JSON
        pe_res.status(201).json(result);
    }
}

/* *** Búsqueda *** */
const ctrl_buscar = async (pi_req = request, pe_res = response) => {
    // guhi Se agrega funcionalidad para filtrar por status 
    // const lv_where = pi_req.body.where;
    let lv_where = pi_req.body.where;
    // guhi

    const rfc = pi_req.params.rfc;
    debugger

    // You can either query the collections at the root of the database...
    const db = admin.firestore().collection(rfc).doc(dbColCont);
    // And then just pass that reference to FireSQL
    const fireSQL = new FireSQL(db, { includeId: 'idContrato' });
    let result = {};
    console.log(lv_where)

    // guhi Se agrega funcionalidad para filtrar por status 
    if(lv_where == '*' ){
        lv_where = "( estatus = '' )";    
    }  else{
        lv_where = lv_where + " " + "AND  ( estatus = ''  )";
    }
    // guhi Se agrega funcionalidad para filtrar por status 

    console.log(lv_where)

    try {
        if (lv_where == '*') {
            await fireSQL.query(`SELECT * FROM ${subColHdr} where estatus != '01' `).then(documents => {
                result = documents
            });
        } else {
        
        // Se revisa el estatus
                await fireSQL.query(`SELECT * FROM ${subColHdr} where  ${lv_where} `).then(documents => {
                result = documents
            });
        }  

        //console.log(result)
        // where estatus != '01' - AND estatus != '01'
        // INI SHV 03.02.2022
        // let result2 = [{}];
        // for(let element of result){
        //     if(element.estatus != '01'){
        //      result2.push(element);
        //     }
        //    }

        //result = result2;
        // FIN SHV 03.02.2022

        if (result.length == 0) {
            pe_res.status(400).json({
                e_subrc: 4,
                msg: 'No se encontraron resultados'
            });
        } else {
        // Enviar los documentos de los clientes en formato JSON
        pe_res.status(201).json(result);
        }
        
    } catch (error) {
        pe_res.status(400).json({
            e_subrc: 4,
            msg: `Ha ocurrido un error al efectuar la búsqueda ${error}` 
        });
    }
   
    
    
   
}

/* * Crear partida * */
const ctrl_crear_partida = async (pi_req = request, pe_res = response) => {
    // Instancia de firestore
    db = admin.firestore();
    dbInsert = admin.firestore();

    // Obtener información de proveedor a guardar
    const rfc = pi_req.params.rfc;
    const idContrato = pi_req.params.idContrato;
    const det = pi_req.body.det;

    // Eliminar propiedad de idContrato
    delete det.idPosnr;

    // Referencia a Firebase
    db = admin.firestore().collection(rfc).doc(dbColCont)
    .collection(subColDet).doc(idContrato)
    //.collection(subColPosiciones);
    let result = {};

    // And then just pass that reference to FireSQL
    const fireSQL = new FireSQL(db, { includeId: 'idPosnr' });
    await fireSQL.query(`SELECT * FROM ${subColPosiciones}`).then(documents => {
        result = documents
    });

    let nextIdPosnr = result.length;

    console.log(nextIdPosnr)

    // Realizar inserción
    try {
        // Update detail
            await dbInsert.collection(rfc).doc(dbColCont)
                .collection(subColDet).doc(idContrato)
                .collection(subColPosiciones).doc(`${nextIdPosnr}`).set(det);
        return pe_res.status(200).json({
            e_subrc: 0,
            msg: `Alta de posición.`
        });
    } catch (error) {
        pe_res.status(400).json({
            e_subrc: 4,
            msg: `Error al insertar posición de: ${idContrato} contrato en BD - ${error}`
        });
    }
}

/* *** Actualizar partida *** */
const ctrl_actualizar_partida = async (pi_req = request, pe_res = response) => {

    // Instancia de firestore
    db = admin.firestore();

    // Obtención de parámetros
    const rfc = pi_req.params.rfc;
    const idContrato = pi_req.params.idContrato;
    const posnr = pi_req.params.posnr;

    // Detalle de posición
    const detPosnr = pi_req.body.det;

    try {
        await db.collection(rfc).doc(dbColCont)
            .collection(subColDet)
            .doc(idContrato)
            .collection(subColPosiciones)
            .doc(posnr).set(detPosnr, { merge: true });
        return pe_res.status(200).json({
            e_subrc: 0,
            msg: `Actualización de posición ${posnr} exitosa.`
        });
    } catch (error) {
        return pe_res.status(400).json({
            e_subrc: 4,
            msg: `Error al actualizar posición ${posnr} - ${error}`
        });
    }

}

/* *** Eliminar partida *** */
const ctrl_eliminar_partida = async (pi_req = request, pe_res = response) => {

    // Instancia de firestore
    db = admin.firestore();

    // Obtención de parámetros
    const rfc = pi_req.params.rfc;
    const idContrato = pi_req.params.idContrato;
    const posnr = pi_req.params.posnr;

    try {
        await db.collection(rfc).doc(dbColCont)
            .collection(subColDet)
            .doc(idContrato)
            .collection(subColPosiciones)
            .doc(posnr).delete();
        return pe_res.status(200).json({
            e_subrc: 0,
            msg: `Posición ${posnr} borrada correctamente.`
        });
    } catch (error) {
        return pe_res.status(400).json({
            e_subrc: 4,
            msg: `Error al borrar posición ${posnr} - ${error}`
        });
    }

}

/* *** Lista de partidas por contrato *** */
const ctrl_lista_partidas = async (pi_req = request, pe_res = response) => {

    // Obtención de parámetros
    const rfc = pi_req.params.rfc;
    const idContrato = pi_req.params.idContrato;

    const db = admin.firestore().
                collection(rfc).doc(dbColCont)
                    .collection(subColDet)
                        .doc(idContrato);
                            //.collection(subColPosiciones);

    const fireSQL = new FireSQL(db, { includeId: 'idPosnr' });
    let result = {};
    await fireSQL.query(`SELECT * FROM ${subColPosiciones}`).then(documents => {
        result = documents
    });

    // Enviar los documentos de los clientes en formato JSON
    pe_res.status(201).json({
        e_subrc: 0,
        result
    });
}



module.exports = {
    ctrl_crear,
    ctrl_actualizar,
    ctrl_eliminar,
    ctrl_infoContrato,
    ctrl_lista,
    ctrl_buscar,
    ctrl_actualizar_partida,
    ctrl_eliminar_partida,
    ctrl_lista_partidas,
    ctrl_crear_partida
}

/* *** Obtener fecha dactual *** */
function getfechaActual() {
    let date = new Date();
    let year = date.getFullYear();
    let month = "0" + (date.getMonth() + 1);
    let day = date.getDate()

    return `${day}.${month}.${year}`;

}

// Función para crear nuevo servicio || actualizar datos del Servicio
async function getNextNumber(rfc, IdNumberRange) {
    let resp;
    const numberRangeRef = db.collection(rfc).doc('RANGOS').collection('LISTA').doc(IdNumberRange);
    try {
        const tx = await db.runTransaction(async t => {
            const doc = await t.get(numberRangeRef);
            const newNumberRange = doc.data().number + 1;
            if (newNumberRange <= 1000000) {
                await t.update(numberRangeRef, { number: newNumberRange });
                resp = {
                    e_subrc: 0,
                    value: newNumberRange
                };
            } else {
                resp = {
                    e_subrc: 4,
                    msg: 'Error al trámitar siguiente consecutivo.'
                };
            }
        });
    } catch (e) {
        resp = {
            e_subrc: 4,
            msg: `Error al trámitar siguiente consecutivo - ${e}`
        };
    }
    return resp;
}