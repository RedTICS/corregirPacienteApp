// My Imports
import * as configPrivate from './config.private.js';
import {
    Matching
} from '@andes/match';

// Imports 3rd Parties
let matcheosFull = 0;
let matcheosBajos = 0;
let noVinculados = 0;
let limiteQuery = 300;
let counter = 0;
let mongoClient = require('mongodb').MongoClient;
let winston = require('winston');
let urlAndes = configPrivate.urlMongoAndes;
let urlMpi = configPrivate.urlMongoMpi;
let coleccionPacientesApp = 'pacienteAppBk'; // Colección de backup usada para la prueba
let coleccionPacientes = 'paciente';
let logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)(),
      new (winston.transports.File)({ filename: 'corregirPaciente.log' })
    ]
  });

let condicion = {
    'pacientes': {
        $size: 1
    }
};

mongoClient.connect(urlAndes, function (err, db) {

    db.collection(coleccionPacientesApp).find(condicion).limit(limiteQuery).toArray(function (error, pacienteApp: any) {
        if (error) {
            console.log('Error al conectarse a la base de datos ', error);
        }
        if (pacienteApp.length > 0) {
            pacienteApp.forEach(async pacApp => {
                let pacienteVinculado = await buscaPacienteVinculado(pacApp);
                if (pacienteVinculado) {
                    let matcheo = await matchPacientes(pacApp, pacienteVinculado);
                    if (matcheo <= 0.95) {
                        //TODO Devincular asignar un array vacío al campo "pacientes" de pacienteAPP
                        let pacToUpdate = {
                            nombre : pacApp.nombre,
                            apellido : pacApp.apellido,
                            documento : pacApp.documento,
                            sexo : pacApp.documento,
                            email : pacApp.email,
                            telefono : pacApp.telefono,
                            pacientes: pacApp.pacientes
                        }
                        logger.log('info','Pacientes modificados: ', pacToUpdate);
                        db.collection(coleccionPacientesApp).updateOne({_id:pacApp._id},{$set:{pacientes:[]}})
                        //
                    }
                } else {
                    noVinculados = noVinculados + 1;
                    // logger.log('info','Id del paciente no vinculado: ', pacApp.pacientes[0].id);
                    console.log('Id del paciente no vinculado: ', pacApp.pacientes[0].id)
                }
                counter++
                if (counter === pacienteApp.length) {
                    db.close();
                    console.log('Pacientes que matchean mayor o igual al 95%: ', matcheosFull);
                    console.log('Pacientes con valor de matching menor al 95% están mal vinculados: ', matcheosBajos);
                    console.log('valor de pacientes no vinculados, están en la base local ANDES: ', noVinculados);
                }
            });

        } else {
            console.log('No existen pacientes con esa condición');
        }
    });
});


function buscaPacienteVinculado(unPacienteAPP: any) {
    return new Promise((resolve, reject) => {
        mongoClient.connect(urlMpi, function (err, db2) {
            db2.collection(coleccionPacientes).findOne({
                '_id': unPacienteAPP.pacientes[0].id
            }, function (err, item) {
                if (err) {
                    console.log('entro por este error:', err);
                    reject(err);
                    db2.close();
                } else {
                    if (item) {
                        resolve(item);
                        db2.close();
                    } else {
                        resolve(null);
                        db2.close();
                    }
                }

            });
        });
    });
};

function matchPacientes(pacienteApp, pacienteVinculado) {
    return new Promise((resolve, reject) => {
        let match = new Matching();
        let pacApp = {
            apellido: pacienteApp.apellido,
            nombre: pacienteApp.nombre,
            sexo: pacienteApp.sexo.toUpperCase(),
            fechaNacimiento: pacienteApp.fechaNacimiento,
            documento: pacienteApp.documento
        };
        let pac = {
            apellido: pacienteVinculado.apellido,
            nombre: pacienteVinculado.nombre,
            sexo: pacienteVinculado.sexo.toUpperCase(),
            fechaNacimiento: pacienteVinculado.fechaNacimiento,
            documento: pacienteVinculado.documento
        }
        // console.log('El dto del pacienteApp: ', pacApp);
        // console.log('El dto del paciente Vincualdo:', pac);
        let valorMatching = match.matchPersonas(pacApp, pac, configPrivate.mpi.weightsDefault, 'Levenshtein');
        //console.log('Valor del matching: ', valorMatching);
        if (valorMatching >= 0.95) {
            matcheosFull = matcheosFull + 1;
            resolve(valorMatching);
        } else {
           
            matcheosBajos = matcheosBajos + 1;
            resolve(valorMatching);
        }

    })

}