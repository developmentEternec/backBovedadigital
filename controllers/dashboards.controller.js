const { response, request } = require('express');
const admin = require("firebase-admin");

const { FireSQL } = require('firesql');

// Nombre de la colección de proveedores
const dbNameProv = "PROVEEDORES";

// Nombre de la colección de dashboards
const dashboards = 'DASHBOARDS';

/* *** Carga de facturas *** */
const ctrl_info_prov = async (pi_req = request, pe_res = response, next) => {

    const rfc = pi_req.params.rfc;

    // Obtener mensajes
    const message = await getMessages(rfc);

    const { fecha_ini, fecha_fin, registros } = pi_req.body;

    const regex = /^[0-9]*$/;

    let lv_where = '';

    // Validar que solo se ingresen números
    const onlyNumbers = regex.test(`${registros}`);
    if(!onlyNumbers){
        return pe_res.status(400).json({
            e_subrc: 4,
            msg: `${message['010']}`
        });
    } else {
        if(registros > 0){
            lv_where = `LIMIT ${registros} `;
        }
    }

    const db = admin.firestore().collection(rfc).doc(dashboards);

    const fireSQL = new FireSQL(db, { includeId: 'rfcProveedor' });

    let result;
    
    await fireSQL.query(`SELECT * FROM ${dbNameProv} ORDER BY __name__ ASC ${lv_where}`).then(info => {
        result = info
    });

    if(result.length === 0){
        return pe_res.status(400).json({
            e_subrc: 4,
            msg: `${message['011']}`
        });
    }
    
    for(let prov of result){
        const db2 = admin.firestore().collection(rfc).doc(dashboards).collection(dbNameProv).doc(`${prov.rfcProveedor}`);
        const fireSQL2 = new FireSQL(db2, { includeId: 'fecha' });
        await fireSQL2.query(`SELECT * FROM MONTO WHERE ( __name__ >= '${fecha_ini}' AND __name__ <= '${fecha_fin}' )`).then(montos => {
            for(let monto of montos){
                if(!prov.data){
                    prov.data = monto;
                } else {
                    prov.data.subtotal  = parseFloat(prov.data.subtotal) + parseFloat(monto.subtotal);
                    prov.data.total     = parseFloat(prov.data.total) + parseFloat(monto.total);
                    prov.data.impuestos = parseFloat(prov.data.impuestos) + parseFloat(monto.impuestos);
                }
                delete prov.data.fecha;
            }
        });
    }
    
    return pe_res.status(201).json({
        e_subrc: 0,
        result
    });
}

/* *** Exportar controladores *** */
module.exports = {
    ctrl_info_prov
}

/* ***  Funciones auxiliares *** */
async function getMessages(rfc){    
    db = admin.firestore();
    const msgRefDoc = db.collection(rfc).doc('MENSAJES');
    const snapshot = await msgRefDoc.get();
    return snapshot.data();
}