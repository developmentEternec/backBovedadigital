const { response, request } = require('express');
const { Storage } = require('@google-cloud/storage');
const admin = require("firebase-admin");

//const storage = new Storage();
const storage = new Storage({ keyFilename: 'key.json' });

// Parseo de XML a JSON
let parseString = require('xml2js').parseString;

// Nombre del bucket
let bucketNameGCP = process.env.BUCKETNAME;

// Instancia del bucket
let bucket;

const { FireSQL } = require('firesql');
const { collection } = require('firebase/firestore');

// Nombre de la colección
const dbNameProv = "PROVEEDORES";
const subFacturas = 'FACTURAS';
const directorioFacturas = 'FACTURAS';

// INI JHN 22.05.2022
const dashboards = 'DASHBOARDS';
// FIN JHN 22.05.2022

/* *** Carga de facturas *** */
const ctrl_carga = async (pi_req = request, pe_res = response, next) => {
    // Referencia a Firebase
    db = admin.firestore();

    const rfc       = pi_req.params.rfc;
    const files     = pi_req.files;
    let contratos   = pi_req.body.contratos;
    let contratosJson;

    // Se valida si existe algun contrato
    if (contratos === '' || contratos === undefined) {
        contratos = undefined;
    } else {
        contratosJson = JSON.parse(contratos);
    }

    // Array Para guardar datos y mandar a FireStore
    let hdr = {};
    let det = [{}];

    // Arreglos para separación de archivos PDF y XML
    let filesPDF = [];
    let filesXML = [];

    // Json de mensajes
    let msg                   = [];
    let contratosObligatorios = [];
    let provList;
    let lv_subrc        = 0;
    let lv_subrc_export = 0;

    // Obtener configuración para nombre de bucket definido para el guardado de archivos
    bucketNameGCP = await getSingleValue(rfc, 'BUCKET_TO_SAVE_FILES_CLOUD_STORAGE');
    console.log(bucketNameGCP)
    bucket = storage.bucket(bucketNameGCP);

    // Se valida que existan archivos, de lo contrario se manda msj
    if (!files || files.length == 0) {
        return pe_res.status(400).json({
            e_subrc: 4,
            msg: "No hay archivos para cargar."
        });
    }

    // Validar que solo se envien archivos con extensión PDF y/o XML
    files.forEach((element) => {
        if (element.mimetype != 'application/pdf' && (element.mimetype != 'text/xml' && element.mimetype != 'application/xml')) {
            return pe_res.status(400).json({
                e_subrc: 4,
                msg: "Solo se aceptan archivos xml y pdf."
            });
        } else {
            if (element.mimetype == 'application/pdf') {
                filesPDF.push(element);
            } else if (element.mimetype == 'text/xml' || element.mimetype == 'application/xml') {
                filesXML.push(element);
            }
        }
    })

    // Obtención de lista de proveedores
    provList = await getProvList(rfc, dbNameProv);
    let path;
    let FACTURAS = 'FACTURAS'

    try {
        // Se recorren los archivos XML
        filesXML.forEach(async (file) => {

            // Limpieza de json
            hdr = {};
            det = [{}];

            lv_subrc = 0;
            // Se recorren los archivos PDF
            if (file.mimetype === 'text/xml' || file.mimetype === 'application/xml') {
                const xml = file.buffer;
                parseString(xml, (err, result) => {
                    // Se obtiene nombre del archivo XML
                    const xmlName = file.originalname.split(".");
                    // Obtención de campos cabecera
                    hdr.uuid = result['cfdi:Comprobante']['cfdi:Complemento'][0]['tfd:TimbreFiscalDigital'][0].$.UUID.toUpperCase();
                    hdr.idContrato = getContrato(hdr.uuid, contratosJson);
                    hdr.rfcEmisor = result['cfdi:Comprobante']['cfdi:Emisor'][0].$.Rfc;
                    hdr.razonSocialEmisor = result['cfdi:Comprobante']['cfdi:Emisor'][0].$.Nombre;
                    hdr.rfcReceptor = result['cfdi:Comprobante']['cfdi:Receptor'][0].$.Rfc;
                    hdr.razonSocialReceptor = result['cfdi:Comprobante']['cfdi:Receptor'][0].$.Nombre || '';
                    // Fecha y hr de expedición
                    hdr.fechaExpedicion = getfechaEmision(result['cfdi:Comprobante'].$.Fecha);
                    hdr.hrExpedicion = gethoraEmision(result['cfdi:Comprobante'].$.Fecha);
                    hdr.usoCFDI = result['cfdi:Comprobante']['cfdi:Receptor'][0].$.UsoCFDI;
                    hdr.formaPago = result['cfdi:Comprobante'].$.FormaPago;
                    hdr.metodoPago = result['cfdi:Comprobante'].$.MetodoPago;
                    hdr.serie = result['cfdi:Comprobante'].$.Serie || '';
                    hdr.folio = result['cfdi:Comprobante'].$.Folio || '';
                    hdr.subtotal = result['cfdi:Comprobante'].$.SubTotal;
                    hdr.iva = result['cfdi:Comprobante']['cfdi:Impuestos'][0].$.TotalImpuestosTrasladados;
                    hdr.total = result['cfdi:Comprobante'].$.Total;
                    hdr.moneda = result['cfdi:Comprobante'].$.Moneda;
                    hdr.tipoComprobante = result['cfdi:Comprobante'].$.TipoDeComprobante;
                    hdr.fileNameXML = file.originalname;
                    hdr.estatus = '01';
                    hdr.usuarioBorrado = '';
                    hdr.fechaBorrado = '';
                    // Obtener tipo de factura (emitida/recibida)
                    hdr.tipoFactura = getFactType(rfc, hdr.rfcEmisor);
                    // Obtener archivo PDF (en caso de que se encuentre)
                    hdr.fileNamePDF = getNamePdfFile(xmlName[0], filesPDF);
                    // Obtención de fecha y hr de carga
                    hdr.fechaCarga = getfechaCarga();
                    hdr.hrCarga = gethoraCarga();
                    // Ruta de guardado de archivos
                    const dateSplit = hdr.fechaExpedicion.split('-');
                    hdr.path = `${rfc}/${directorioFacturas}/${hdr.tipoFactura}/${dateSplit[0]}/${dateSplit[1]}`;
                    hdr.bucketGCP = bucketNameGCP;
                    // Obtención de campos detalle
                    const lv_total_posiciones = result['cfdi:Comprobante']['cfdi:Conceptos'][0]['cfdi:Concepto'].length;
                    let lv_pos = 0;
                    while (lv_pos < lv_total_posiciones) {
                        const pos_det = result['cfdi:Comprobante']['cfdi:Conceptos'][0]['cfdi:Concepto'][lv_pos].$;

                        det[lv_pos] = {
                            posicion: lv_pos,
                            numeroIdentificacion: pos_det.NoIdentificacion || '',
                            claveProductoServicio: pos_det.ClaveProdServ || '',
                            descripcion: pos_det.Descripcion || '',
                            claveUnidad: pos_det.ClaveUnidad || '',
                            cantidad: pos_det.Cantidad || '',
                            valorUnitario: pos_det.ValorUnitario || '',
                            importe: pos_det.Importe || '',
                            unidad: pos_det.Unidad || ''
                        }
                        lv_pos++;
                    }
                })
                // Se valida que el rfc receptor coincida con el rfc del usuario Logueado.
                if (hdr.rfcReceptor !=rfc && hdr.rfcEmisor!= rfc)  {
                    console.log('CTRL_CARGA NO FACTURA PERSONAL');
                    pe_res.status(400).json({
                        e_subrc: 4,
                        msg: "El rfc receptor/emisor del CFDI no coinciden con el rfc del usuario Logueado."
                    });
                    return;
                } else if(hdr.rfcReceptor == rfc || hdr.rfcEmisor == rfc){
                    console.log('CTRL_CARGA SI PASA A CARGAR LA FACTURA');
                    
                    lv_subrc = 0;
                    lv_subrc = checkContratoObligatorio2(hdr.rfcEmisor, provList, hdr.idContrato);
                    if (lv_subrc !== 0) {
                        //lv_subrc_export = lv_subrc;
                    }
                    
                    // Si el CFDI no tiene configurado que el proveedor tenga contrato obligatorio
                    // :. se procede a realizar la carga
                    if (lv_subrc === 0) {
                        // Grabar en firestore
                        const uuid = hdr.uuid;
                        delete hdr.uuid;
                        // Creación de la subcolección header
                        db.collection(rfc).doc(subFacturas).set({})
                        await db.collection(rfc).doc(subFacturas).collection('HDR').doc(uuid).set(hdr);
                        // Creación de la subcolección detalle
                        
                        for (let i in det) {
                            const posicion = det[i].posicion;
                            path = await db.collection(rfc).doc(FACTURAS).collection('HDR').doc(uuid).collection('DET').doc(`${posicion}`).set(det[i])
                            //await db.collection(rfc).doc(subFacturas).collection('HDR').doc(uuid).collection('DET').doc(`${posicion}`).set(det[i])
                        }
// INI JHN 20.05.2022 Actualización de monto de factura en colección DASHBOARDS
                        msg.push(await updateDashboardCFDI(rfc, hdr));
// FIN JHN 20.05.2022
                        // Carga de archivos a GCP
                        //XML
                        msg.push(msgUpload = await uploadFile(file.buffer, rfc, hdr.tipoFactura, hdr.fechaExpedicion, file.originalname));
                        // PDF
                        if (hdr.fileNamePDF !== '') {
                            nextMsg = msg.length + 1;
                            // Obtener archivo
                            const pdf = getFilePDF(hdr.fileNameXML, filesPDF);
                            await uploadFile(pdf, rfc, hdr.tipoFactura, hdr.fechaExpedicion, hdr.fileNamePDF);
                        }
                        
                    } else {
                        msg.push(getMsg(lv_subrc, hdr.uuid))
                        contratosObligatorios.push({
                            uuid: hdr.uuid,
                            rfcEmisor: hdr.rfcEmisor,
                            fileXML: hdr.fileNameXML,
                            filePDF: hdr.fileNamePDF || ''
                        });
                    }
                }
            }
            pe_res.status(200).json({
                e_subrc: lv_subrc_export,
                msg,
                contratosObligatorios
            });
        })
        //console.log(contratosObligatorios)
        //pe_res.status(200).json({
            //e_subrc: lv_subrc_export,
            //msg,
            //contratosObligatorios
        //});
        //return;
    } catch (error) {
        pe_res.status(200).json({
            e_subrc: 4,
            msg: `Error al cargar información: ${error}`
        });
        return;
    }

}

// INI JHN 31.01.2022
/* *** Validar de facturas *** */
const ctrl_validar = async (pi_req = request, pe_res = response) => {

    // Referencia a Firebase
    db = admin.firestore();

    const rfc = pi_req.params.rfc;
    const files = pi_req.files;

    // Array Para guardar datos y mandar a FireStore
    let hdr = {};
    let det = [{}];

    // Arreglos para separación de archivos PDF y XML
    let filesPDF = [];
    let filesXML = [];
    let provContractObl = [];
    let listaContratos;

    // Json de mensajes
    let msg = [];
    let contratosObligatorios = [];
    let provList;
    let provListQueryBlackList = [];
    let blackListProv;

    // Obtener mensajes
    const message = await getMessages(rfc);

    // Guardado de UUID's para validar si ya habían sido cargados anteriormente
    let uuidListToLoad = [];

    // Se valida que existan archivos, de lo contrario se manda msj
    if (!files || files.length == 0) {
        return pe_res.status(400).json({
            e_subrc: 4,
            msg: `${message['001']}`
        });
    }

    // Validar que solo se envien archivos con extensión PDF y/o XML
    files.forEach((element) => {
        if (element.mimetype != 'application/pdf' &&
            (element.mimetype != 'text/xml' && element.mimetype != 'application/xml')) {
            return pe_res.status(400).json({
                e_subrc: 4,
                msg: `${message['002']}`
            });
        } else {
            if (element.mimetype == 'application/pdf') {
                filesPDF.push(element);
            } else if (element.mimetype == 'text/xml' || element.mimetype == 'application/xml') {
                filesXML.push(element);
            }
        }
    })

    // Obtención de lista de proveedores
    provList = await getProvList(rfc, dbNameProv);

    try {

        // Se recorren los archivos XML
        filesXML.forEach(async (file) => {
            // Limpieza de json
            hdr = {};
            det = [{}];

            // Reseteo de variable
            lv_subrc = 0;

            // Se recorren los archivos PDF
            if (file.mimetype === 'text/xml' || file.mimetype === 'application/xml') {
                const xml = file.buffer;
                parseString(xml, (err, result) => {
                    // Se obtiene nombre del archivo XML
                    const xmlName           = file.originalname.split(".");
                    // Obtención de campos cabecera
                    hdr.uuid                = result['cfdi:Comprobante']['cfdi:Complemento'][0]['tfd:TimbreFiscalDigital'][0].$.UUID.toUpperCase();
                    uuidListToLoad.push(hdr.uuid);

                    hdr.rfcEmisor           = result['cfdi:Comprobante']['cfdi:Emisor'][0].$.Rfc;
                    hdr.razonSocialEmisor   = result['cfdi:Comprobante']['cfdi:Emisor'][0].$.Nombre;
                    hdr.rfcReceptor         = result['cfdi:Comprobante']['cfdi:Receptor'][0].$.Rfc;
                    hdr.razonSocialReceptor = result['cfdi:Comprobante']['cfdi:Receptor'][0].$.Nombre;
                    // Fecha y hr de expedición
                    hdr.fechaExpedicion     = getfechaEmision(result['cfdi:Comprobante'].$.Fecha);
                    hdr.hrExpedicion        = gethoraEmision(result['cfdi:Comprobante'].$.Fecha);
                    hdr.usoCFDI             = result['cfdi:Comprobante']['cfdi:Receptor'][0].$.UsoCFDI;
                    hdr.formaPago           = result['cfdi:Comprobante'].$.FormaPago;
                    hdr.metodoPago          = result['cfdi:Comprobante'].$.MetodoPago;
                    hdr.serie               = result['cfdi:Comprobante'].$.Serie || '';
                    hdr.folio               = result['cfdi:Comprobante'].$.Folio || '';
                    hdr.subtotal            = result['cfdi:Comprobante'].$.SubTotal;
                    hdr.iva                 = result['cfdi:Comprobante']['cfdi:Impuestos'][0].$.TotalImpuestosTrasladados;
                    hdr.total               = result['cfdi:Comprobante'].$.Total;
                    hdr.moneda              = result['cfdi:Comprobante'].$.Moneda;
                    hdr.tipoComprobante     = result['cfdi:Comprobante'].$.TipoDeComprobante;
                    hdr.fileNameXML         = file.originalname;
                    hdr.estatus             = '01';
                    hdr.usuarioBorrado      = '';
                    hdr.fechaBorrado        = '';

                    // Obtener tipo de factura (emitida/recibida)
                    hdr.tipoFactura         = getFactType(rfc, hdr.rfcEmisor);

                    // Obtener archivo PDF (en caso de que se encuentre)
                    hdr.fileNamePDF         = getNamePdfFile(xmlName[0], filesPDF);

                    // Obtención de fecha y hr de carga
                    hdr.fechaCarga          = getfechaCarga();
                    hdr.hrCarga             = gethoraCarga();

                    // Guardado de proveedor para consultar más adelante la lista negra
                    provListQueryBlackList.push(hdr.rfcEmisor);

                    // Obtención de campos detalle
                    const lv_total_posiciones = result['cfdi:Comprobante']['cfdi:Conceptos'][0]['cfdi:Concepto'].length;
                    let lv_pos = 0;
                    while (lv_pos < lv_total_posiciones) {
                        const pos_det = result['cfdi:Comprobante']['cfdi:Conceptos'][0]['cfdi:Concepto'][lv_pos].$;
                        det[lv_pos] = {
                            posicion                : lv_pos,
                            numeroIdentificacion    : pos_det.NoIdentificacion  || '',
                            claveProductoServicio   : pos_det.ClaveProdServ     || '',
                            descripcion             : pos_det.Descripcion       || '',
                            claveUnidad             : pos_det.ClaveUnidad       || '',
                            cantidad                : pos_det.Cantidad          || '',
                            valorUnitario           : pos_det.ValorUnitario     || '',
                            importe                 : pos_det.Importe           || '',
                            unidad                  : pos_det.Unidad            || ''
                        }
                        lv_pos++;
                    }
                });

                // Se valida que el rfc receptor o rfc emisor coincida con el rfc del usuario Logueado.
                if (hdr.rfcReceptor!= rfc && hdr.rfcEmisor!= rfc) {
                    console.log('NO PASAN FACTURAS PERSONALES');
                    console.log(hdr.rfcEmisor);
                    console.log(hdr.rfcReceptor);
                    console.log(rfc);
                    msg.push({
                        e_subrc: 4,
                        msg: `${message['003']} ${file.originalname} ${message['004']} ${rfc}.`
                    });
                    contratosObligatorios.push({
                        uuid                : hdr.uuid,
                        contratoObligatorio : '',
                        rfcEmisor           : hdr.rfcEmisor,
                        razonSocEmisor      : hdr.razonSocialEmisor,
                        tipoComprobante     : hdr.tipoComprobante,
                        subTotal            : hdr.subtotal,
                        total               : hdr.total,
                        fileXML             : hdr.fileNameXML,
                        filePDF             : hdr.fileNamePDF || '',
                        canLoad             : 'NO',
                        provExistBD         : 'NO',
                        msg                 : `${message['003']} ${file.originalname} ${message['004']} ${rfc}`
                    });
                } else if(hdr.rfcReceptor == rfc || hdr.rfcEmisor == rfc){
                   console.log('SI PASA CUALQUIERA DE LOS DOS OR');
                    let lv_contrato_oblig = '';
                    hdr.idContrato        = '';

                    // Validar si el proveedor del CFDI tiene configurado el contrato obligatorio
                    lv_contrato_oblig = checkContratoObligatorio(hdr.rfcEmisor, provList, hdr.idContrato);
                    contratosObligatorios.push({
                        uuid                : hdr.uuid,
                        contratoObligatorio : `${lv_contrato_oblig}`,
                        rfcEmisor           : hdr.rfcEmisor,
                        razonSocEmisor      : hdr.razonSocialEmisor,
                        tipoComprobante     : hdr.tipoComprobante,
                        subTotal            : hdr.subtotal,
                        total               : hdr.total,
                        fileXML             : hdr.fileNameXML,
                        filePDF             : hdr.fileNamePDF || '',
                        canLoad             : 'SI',
                        provExistBD         : 'NO'
                    });

                    //  Guardar rfc emisor del CFDI para más adelante obtener los contratos por proveedor
                    if(lv_contrato_oblig === 'SI'){
                        provContractObl.push(hdr.rfcEmisor);
                    }
                }
            }
        });

        // Obtener lista de contratos de proveedores en CFDI's
        listaContratos = await getListaContratos(rfc, provContractObl);

        // Armado de lista de contratos por proveedor
        for (let fact of contratosObligatorios) {
            const json = getContratosByRfc(listaContratos, fact.rfcEmisor);
            fact.lista = json;
        }

        // Obtener lista de facturas ya cargadas anteriormente
        const uuidInBD = await getUuidList(rfc, uuidListToLoad);

        // Si la factura ya existe en BD no se permite cargar nuevamente
        for(let fact of contratosObligatorios){
            for(let uuid of uuidInBD){
                if(fact.uuid === uuid){
                    fact.canLoad = 'NO';
                    fact.msg     = `${message['007']}`;
                }
            }
        }

        // Validar que el proveedor exista
        for(let fact of contratosObligatorios){
            for(let prov of provList){
                if(fact.rfcEmisor === prov.rfc){
                    fact.provExistBD = 'SI';
                }
            }
        }

        // Validar que el proveedor de la factura a cargar no se encuentre en la lista negra
        blackListProv = await getBlackListProv(provListQueryBlackList);
        if(blackListProv.length > 0){
            for(let fact of contratosObligatorios){
                for(let provInBlackList of blackListProv){
                    if(fact.rfcEmisor === provInBlackList){
                        fact.canLoad = 'NO';
                        fact.msg = `${message['008']}`;
                    }
                }
            }
        }


        // Validar si la factura cargada tiene config. el indicar contrato obligatorio :. se valida que existan contratos
        // en caso de que no haya contratos creados se marca como no autorizado para cargar
        for(let fact of contratosObligatorios){
            const valLista = Object.entries(fact.lista);
            if(valLista.length === 0 && fact.contratoObligatorio === 'SI' && fact.provExistBD === 'SI'){
                fact.canLoad = 'NO';
                fact.msg     = `${message['006']}`;
            }
        }
        console.log(contratosObligatorios)
        return pe_res.status(200).json({
            e_subrc: 0,
            msgPool: msg,
            contratosObligatorios
        });

    } catch (error) {
        msg.push({
            e_subrc: 4,
            msg: `${message['005']}: ${error}`
        });
        pe_res.status(400).json({
            e_subrc: 4,
            msgPool: msg
        });
        return;
    }

}
// FIN JHN 31.01.2022

/* *** Descarga de facturas *** */
const ctrl_descarga = async (pi_req = request, pe_res = response, next) => {

    // Referencia a Firebase
    db = admin.firestore();

const { rfc, tFactura, year, month, uuid } = pi_req.params;
    // console.log(pi_req.params)

    // Instancias para obtención de URL de archivos
    const storagePDF = new Storage();
    const storageXML = new Storage();

    // Nombre de los archivos
    let fileNamePDF = '';
    let fileNameXML = '';

    // Endpoints para acceso a los archivos
    let endpointPDF = '';
    let endpointXML = '';

    // Nombre del bucket
    let bucketName = process.env.BUCKETNAME;

    try {
        const factRef = db.collection(rfc).doc(subFacturas).collection('HDR').doc(uuid);
        const doc = await factRef.get()
        if (!doc.exists) {
            return pe_res.status(200).json({
                e_subrc: 4,
                msg: `No se encontró la factura solicitada.`
            });
        } else {
            // Obtener nombres de los archivos
            fileNamePDF = doc.data().fileNamePDF;
            fileNameXML = doc.data().fileNameXML;
        }

        console.log(fileNamePDF, fileNameXML)

        if (fileNamePDF !== '') {
            //Create a reference to the file to generate link
            let fileRefDOC = await storagePDF.bucket(bucketName).file(`${rfc}/${directorioFacturas}/${tFactura}/${year}/${month}` + fileNamePDF)
            await fileRefDOC.exists()
                .then(async function (data) {
                    endpointPDF = await generateV4ReadSignedUrl(bucketName, rfc, directorioFacturas, tFactura, year, month, fileNamePDF)
                    console.log(endpointPDF)
                })
        }

        if (fileNameXML != '') {
            //Create a reference to the file to generate link
            let fileRefDOC = await storagePDF.bucket(bucketName).file(`${rfc}/${directorioFacturas}/${tFactura}/${year}/${month}` + fileNameXML)
            await fileRefDOC.exists()
                .then(async function (data) {
                    endpointXML = await generateV4ReadSignedUrl(bucketName, rfc, directorioFacturas, tFactura, year, month, fileNameXML)
                    console.log(endpointPDF)
                })
        }

        pe_res.status(200).json({
            e_subrc: 0,
            urlPDF: endpointPDF,
            urlXML: endpointXML,
        });
    } catch (error) {
        pe_res.status(400).json(error);
    }
}

/* *** Carga de facturas *** */
const ctrl_lista = async (pi_req = request, pe_res = response, next) => {

    const rfc = pi_req.params.rfc;

    // Referencia a Firebase
    db = admin.firestore().collection(rfc).doc('FACTURAS');
    let result = {};

    // And then just pass that reference to FireSQL
    const fireSQL = new FireSQL(db, { includeId: 'uuid' });
    try {
        await fireSQL.query(`SELECT * FROM HDR where estatus = '01'`).then(documents => {
            result = documents
        });
        // Validar respuesta
        if (result.length === 0) {
            // Enviar los documentos de las facturas HDR en formato JSON
            pe_res.status(400).json({
                e_subrc: 4,
                msg: 'No hay facturas.'
            });
            return
        } else {
            // Enviar los documentos de las facturas HDR en formato JSON
            pe_res.status(201).json(result);
            return
        }
    } catch (error) {
        // Enviar los documentos de las facturas HDR en formato JSON
        pe_res.status(400).json({
            e_subrc: 4,
            msg: `Error - ${error}`
        });
    }
}

/* *** Eliminar factura *** */
const ctrl_eliminar = async (pi_req = request, pe_res = response, next) => {
    // Referencia a Firebase
    db = admin.firestore();

    // RFC de sociedad y usuario que realiza dicha operación
    const rfc = pi_req.params.rfc;
    const user = pi_req.params.user;
    const uuid = pi_req.params.uuid;
    try {
        const factRef = await db.collection(rfc).doc(subFacturas).collection('HDR').doc(uuid);
        const updateStatus = await factRef.update({ estatus: '02', usuarioBorrado: user, fechaBorrado: getfechaCarga() });
        pe_res.status(200).json({
            e_subrc: 0,
            msg: `Factura: ${uuid} borrada con éxito.`
        });
    } catch (error) {
        pe_res.status(400).json({
            e_subrc: 4,
            msg: `Ha ocurrido un error al borrar la factura: ${uuid} - ${error}`
        });
    }

}

/* *** Buscar factura *** */
const ctrl_buscar = async (pi_req = request, pe_res = response) => {
    const lv_where = pi_req.body.where;
    const rfc = pi_req.params.rfc;

    // You can either query the collections at the root of the database...
    const db = admin.firestore().collection(rfc).doc(subFacturas);
    // And then just pass that reference to FireSQL
    const fireSQL = new FireSQL(db, { includeId: 'uuid' });
    let result = {};

    if (lv_where == '*') {
        await fireSQL.query(`SELECT * FROM HDR `).then(documents => {
            result = documents
        });
    } else {
        await fireSQL.query(`SELECT * FROM HDR where ${lv_where}`).then(documents => {
            result = documents
        });
    }

    // Enviar los documentos de los clientes en formato JSON
    pe_res.status(201).json({
        e_subrc: 0,
        result
    });
}

/* *** Buscar factura *** */
const ctrl_info_fact = async (pi_req = request, pe_res = response) => {
    // Instancia de firestore
    db = admin.firestore();

    // Obtener id de proveedor de parámetros de URL
    const rfc = pi_req.params.rfc;
    const uuid = pi_req.params.uuid;

    // Validar que la factura exista y en caso de, obtener las posiciones
    const snapshotHdr = await db.collection(rfc).doc(subFacturas).collection('HDR').doc(uuid).get();

    // Info header
    let hdr = snapshotHdr.data();

    // Info detail
    let det = {};
    let cont = 0;

    let snapshotDet;
    if (!snapshotHdr.exists) {
        return pe_res.status(400).json({
            e_subrc: 4,
            msg: `No se encontró la factura: ${uuid} en BD.`
        });
    } else {
        // Se setea uuid
        hdr.uuid = snapshotHdr.id;
        // Se obtiene el detalle
        snapshotDet = await db.collection(rfc).doc(subFacturas).collection('HDR').doc(uuid).collection('DET').get();
        snapshotDet.forEach((doc) => {
            const document = doc.data();
            document.uuid = doc.id;
            det[cont] = document;
            cont++
        });
    }

    pe_res.status(200).json({
        e_subrc: 0,
        factura: {
            hdr,
            det
        }
    })
}

/* *** Exportar controladores *** */
module.exports = {
    ctrl_carga,
    ctrl_lista,
    ctrl_eliminar,
    ctrl_buscar,
    ctrl_descarga,
    ctrl_info_fact,
    ctrl_validar
}

/* *** Funciones normales *** */

/* *** Obtener nombre del archivo PDF ligado al XML *** */
function getNamePdfFile(nameXML, filesPDF) {

    let namePDF = '';
    let found = '';
    for (let i in filesPDF) {
        found = '';
        let lv_length = 0;
        while (lv_length < filesPDF.length) {
            const compare = filesPDF[lv_length].originalname.split(".");

            if (compare[0] === nameXML) {
                namePDF = filesPDF[i].originalname;
                found = 'X';
                break;
            }
            lv_length++;
        }
        if (found === 'X') {
            break;
        }
    }
    return namePDF;
}

/* *** Obtener tipo de factura (emitida/recibida) *** */
function getFactType(rfc, rfcEmisor) {
    if (rfc === rfcEmisor) {
        return 'E';
    } else {
        return 'R';
    }
}

/* *** Obtener fecha de carga *** */
function getfechaCarga() {
    const date = new Date();
    let day = date.getDate();

    let year = date.getFullYear();
    if ((date.getMonth() + 1) <= 9) {
        month = "0" + (date.getMonth() + 1);
    } else {
        month = (date.getMonth() + 1);
    }

    //
    if (date.getUTCDate() <= 9) {
        day = "0" + date.getUTCDate();
    } else {
        day = date.getUTCDate();
    }


    return `${day}-${month}-${year}`;
}

/* *** Obtener hora de carga *** */
function gethoraCarga() {
    let date = new Date();
    let hora;
    let minutos;
    let segundos;

    //Hora de modificacion
    if (date.getHours() <= 9) {
        hora = '0' + date.getHours();
    } else {
        hora = date.getHours();
    }

    //Calculo de minutos
    if (date.getMinutes() <= 9) {
        minutos = '0' + date.getMinutes();
    } else {
        minutos = date.getMinutes();
    }

    //Calculo de secgundos
    if (date.getSeconds() <= 9) {
        segundos = '0' + date.getSeconds();
    } else {
        segundos = date.getSeconds();
    }

    return `${hora}:${minutos}:${segundos}`
}

/* *** Parseo de fecha de emisión *** */
function getContratosByRfc(contratos, rfcProv) {

    let lista = [];

    for (let contrato of contratos) {
        if (contrato.rfcProveedor == rfcProv) {
            lista.push(`${contrato.idContrato} | ${contrato.nombreLargo}`)
        }
    }
    const strn = JSON.stringify(Object.assign({}, lista))
    const jsonOutput = JSON.parse(strn)
    return jsonOutput;
}

/* *** Parseo de fecha de emisión *** */
function getfechaEmision(fecha) {
    const date = new Date(fecha);
    let day = date.getDate();

    let year = date.getFullYear();
    if ((date.getMonth() + 1) <= 9) {
        month = "0" + (date.getMonth() + 1);
    } else {
        month = (date.getMonth() + 1);
    }

    //
    if (date.getUTCDate() <= 9) {
        day = "0" + date.getUTCDate();
    } else {
        day = date.getUTCDate();
    }


    return `${day}-${month}-${year}`;
}

/* *** Parseo de hora de emisión *** */
function gethoraEmision(fecha) {
    let date = new Date(fecha);
    let hora;
    let minutos;
    let segundos;

    //Hora de modificacion
    if (date.getHours() <= 9) {
        hora = '0' + date.getHours();
    } else {
        hora = date.getHours();
    }

    //Calculo de minutos
    if (date.getMinutes() <= 9) {
        minutos = '0' + date.getMinutes();
    } else {
        minutos = date.getMinutes();
    }

    //Calculo de secgundos
    if (date.getSeconds() <= 9) {
        segundos = '0' + date.getSeconds();
    } else {
        segundos = date.getSeconds();
    }

    return `${hora}:${minutos}:${segundos}`
}

/* *** Carga de archivo *** */
async function uploadFile(file, rfcSociedad, tipoFactura, dateE, fileName) {

    //Obtencion de fecha y hora de Emision
    const date = dateE.split("-");
    const year = date[2];
    const month = date[1];
    console.log(date)
    const route = `${rfcSociedad}/${directorioFacturas}/${tipoFactura}/${year}/${month}/`;

    let blob = bucket.file(route + fileName);
    let blobStream = blob.createWriteStream();
    try {
        // Error
        blobStream.on('error', err => { });

        // Success
        blobStream.on('finish', () => { });

        // Cargar archivo
        blobStream.end(file);

        return { msg: `Archivo ${fileName} cargado.` }
    } catch (error) {
        return error;
    }
}

/* *** Obtener archivo PDF *** */
function getFilePDF(nameXML, filesPDF) {

    const nameXMLSplit = nameXML.split(".");
    for (let i in filesPDF) {
        if (filesPDF[i].originalname === `${nameXMLSplit[0]}.pdf`) {
            return filesPDF[i].buffer;
        }
    }
}

/*  Obtener lista de proveedores por sociedad */
async function getProvList(rfcSociedad, dbNameProv) {

    let provList = {};

    // Instancia de firestore
    db = admin.firestore();

    // Referencia a la colección de proveedores
    const provRef = db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA');

    // Obtener lista de proveedores
    const snapshot = await provRef.get();

    if (snapshot.empty) {
        return provList;
    } else {
        provList = snapshot.docs.map((doc) => {
            const document = doc.data();
            document.rfc = doc.id;
            return document;
        });
        return provList;
    }

}

/* Obtener lista negra proveedores */
async function getBlackListProv(listaProveedores){
    let provList = {};

    // Instancia de firestore
    db = admin.firestore();

    // Referencia a la colección de proveedores
    const provRef = db.collection('LISTA_NEGRA');

    // Obtener lista de proveedores
    const snapshot = await provRef.where('__name__', 'in', listaProveedores).get();

    if (snapshot.empty) {
        return provList;
    } else {
        provList = snapshot.docs.map((doc) => {
            return doc.id;
        });
        return provList;
    }
}

/* Obtener facturas ya cargadas previamente*/
async function getUuidList(rfcSociedad, uuidList) {
    let lista = [];

    if(uuidList.length === 0){
        return lista;
    }
    const contratosRef = db.collection(rfcSociedad).doc('FACTURAS').collection('HDR');
    const snapshot = await contratosRef.where('__name__', 'in', uuidList).get();

    snapshot.forEach(doc => {
        lista.push(doc.id);
    });
    return lista;
}


/* *** Validar si es obligatorio especificar contrato para CFDI *** */
function checkContratoObligatorio(rfcEmisor, listaProveedores, contrato) {
    let lv_contr_obl = 'NO';

    // Validar si ya trae contrato :. no se valida regla de contrato obligatorio
    if (contrato !== '') {
        return 'NO';
    }

    for (let i in listaProveedores) {
        if (listaProveedores[i].rfc === rfcEmisor) {
            if (listaProveedores[i].contratoObligatorio === true || listaProveedores[i].contratoObligatorio === 'true') {
                lv_contr_obl = 'SI';
                break;
            }
        }
    }
    return lv_contr_obl;
}

/* * Validar si es obligatorio especificar contrato para CFDI * */
function checkContratoObligatorio2(rfcEmisor, listaProveedores, contrato) {
    let lv_subrc = 0;

    // Validar si ya trae contrato :. no se valida regla de contrato obligatorio
    if (contrato !== '') {
        return lv_subrc;
    }

    for (let i in listaProveedores) {
        if (listaProveedores[i].rfc === rfcEmisor) {
            if (listaProveedores[i].contratoObligatorio === true) {
                lv_subrc = 1;
                break;
            } else {
                lv_subrc = 0;
                break;
            }
        }
    }
    return lv_subrc;
}

/* *** Obtener ID de contrato en caso de que se haya mandado la relación *** */
function getContrato(uuid, contratos) {

    let contrato = '';

    // Si no se manda la relación uuid/contrato se retorna ''
    if (contratos === undefined) {
        return contrato;
    }
    if (contratos.length === 0 || contratos.length === undefined) {
        return contrato;
    } else {
        for (let i in contratos) {
            if (contratos[i].uuid === uuid) {
                contrato = contratos[i].contrato;
                break;
            }
        }
    }
    return contrato;
}

/* *** Envío de mensaje *** */
function getMsg(e_subrc, uuid) {
    if (e_subrc === 0) {
        return {
            e_subrc: 0,
            msg: `Factura ${uuid} cargado correctamente.`
        }
    } else if (e_subrc === 1) {
        return {
            e_subrc: 1,
            msg: `Es necesario especificar el contrato de la factura: ${uuid}`
        }
    } else {
        return {
            e_subrc: 4,
            msg: `Algo ha salido mal al cargar la factura: ${uuid}`
        }
    }
}

/* * Obtener URL autenticada para acceder a los archivos * */
async function generateV4ReadSignedUrl(bucketName, rfc, directorioFacturas, tFactura, year, month, fileName) {

    // These options will allow temporary read access to the file
    const options = {
        version: 'v4',
        action: 'read',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    };

    // Get a v4 signed URL for reading the file
    const [url] = await storage
        .bucket(bucketName)
        .file(`${rfc}/${directorioFacturas}/${tFactura}/${year}/${month}/` + fileName)
        .getSignedUrl(options);

    return url;
}

async function getListaContratos(rfc, proveedores) {

    let lista = [];

    if(proveedores.length === 0){
        return lista;
    }
    const contratosRef = db.collection(rfc).doc('CONTRATOS').collection('HDR');
    const snapshot = await contratosRef.where('rfcProveedor', 'in', proveedores).get();

    snapshot.forEach(doc => {
        const document = doc.data();
        document.idContrato = doc.id;
        if(document.estatus != '01'){
            lista.push(document);
        }

    });
    return lista;
}

// INI JHN 04.03.2022 Implementación de clases de mensajes
async function getMessages(rfc){
    const msgRefDoc = db.collection(rfc).doc('MENSAJES');
    const snapshot = await msgRefDoc.get();
    return snapshot.data();
}
// FIN JHN 04.03.2022

// INI JHN 11.03.2022
async function getSingleValue(rfc, name){
    const tvarvcRefDoc = db.collection(rfc).doc('TVARVC_WEB').collection('SINGLE_VALUES').doc(name);
    const snapshot = await tvarvcRefDoc.get();
    return snapshot.data().low;
}
// FIN JHN 11.03.2022

// INI JHN 23.05.2022 DASHBOARDS
async function updateDashboardCFDI(rfc, hdr) {

    let lv_subrc = 0;

    // Referencia a Firebase
    db = admin.firestore();

    const currentDayDDMMYYYY = buildDDMMYYYY();

    // Obtener información de dashboard
    const dashRef = db.collection(rfc).doc(dashboards).collection(`${dbNameProv}`).doc(`${hdr.rfcEmisor}`)
                                                        .collection('MONTO').doc(`${currentDayDDMMYYYY[0]}${currentDayDDMMYYYY[1]}${currentDayDDMMYYYY[2]}`);
    const doc = await dashRef.get();
    if (!doc.exists) { // Crear registro
        await db.collection(rfc).doc(dashboards).collection(`${dbNameProv}`).doc(`${hdr.rfcEmisor}`).set({});
        await dashRef.set({
            moneda   : hdr.moneda,
            subtotal : hdr.subtotal,
            impuestos: hdr.iva,
            total    : hdr.total
        });
        //await new Promise(resolve => setTimeout(resolve, 1000));
        
    } else {           // Actualizar registro (montos)
        try {
            await db.runTransaction(async (t) => {
              const doc = await t.get(dashRef);
              const sumSubtotal  = parseFloat(doc.data().subtotal)  + parseFloat(hdr.subtotal);
              const sumImpuestos = parseFloat(doc.data().impuestos) + parseFloat(hdr.iva);
              const sumTotal     = parseFloat(doc.data().total)     + parseFloat(hdr.total);
              const newCFDI = {
                moneda   : hdr.moneda,
                subtotal : sumSubtotal,
                impuestos: sumImpuestos,
                total    : sumTotal
              }
              t.update(dashRef, newCFDI);
              //await new Promise(resolve => setTimeout(resolve, 1000));
            });
            console.log('Transaction success!');
            return {
                lv_subrc,
                msg: 'Montos contabilizados en DASHBOARDS'
            }
        } catch (e) {
            lv_subrc = 4;
            console.log('Transaction failure:', e);
            return {
                lv_subrc,
                msg: e
            }
        }
    }
}
/* *** Parseo de fecha de emisión *** */
function buildDDMMYYYY() {

    let date = new Date();
    
    let year = date.getFullYear();
    let month = (date.getMonth() + 1);
    if(month <= 9){
        month = '0' + month;
    }
    
    let day = (date.getDate());
    if(day <= 9){
        day = '0' + day;
    }

    let arr = [`${year}`,`${month}`,`${day}`]
    console.log(arr);
    return arr;
    
}
// FIN JHN 23.05.2022