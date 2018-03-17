"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bson_1 = require("bson");
var ts = bson_1.Timestamp.fromInt(Date.now() - 45000);
console.log(ts);
