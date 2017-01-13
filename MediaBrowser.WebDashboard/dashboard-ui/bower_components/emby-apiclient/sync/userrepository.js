﻿define(['idb'], function () {
    'use strict';

    // Database name
    var dbName = "users";

    // Database version
    var dbVersion = 1;

    var dbPromise;

    function setup() {

        dbPromise = idb.open(dbName, dbVersion, function (upgradeDB) {
            // Note: we don't use 'break' in this switch statement,
            // the fall-through behaviour is what we want.
            switch (upgradeDB.oldVersion) {
                case 0:
                    upgradeDB.createObjectStore(dbName);
                    //case 1:
                    //    upgradeDB.createObjectStore('stuff', { keyPath: '' });
            }
        }); //.then(db => console.log("DB opened!", db));
    }

    function getAll() {
        return dbPromise.then(function (db) {
            return db.transaction(dbName).objectStore(dbName).getAll(null, 10000);
        });
    }

    function get(key) {
        return dbPromise.then(function (db) {
            return db.transaction(dbName).objectStore(dbName).get(key);
        });
    }

    function set(key, val) {
        return dbPromise.then(function (db) {
            var tx = db.transaction(dbName, 'readwrite');
            tx.objectStore(dbName).put(val, key);
            return tx.complete;
        });
    }

    function remove(key) {
        return dbPromise.then(function (db) {
            var tx = db.transaction(dbName, 'readwrite');
            tx.objectStore(dbName).delete(key);
            return tx.complete;
        });
    }

    function clear() {
        return dbPromise.then(function (db) {
            var tx = db.transaction(dbName, 'readwrite');
            tx.objectStore(dbName).clear(key);
            return tx.complete;
        });
    }

    setup();

    return {
        get: get,
        set: set,
        remove: remove,
        clear: clear,
        getAll: getAll
    };
});