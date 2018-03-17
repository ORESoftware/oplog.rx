import {Timestamp} from "bson";
const ts = Timestamp.fromInt(Date.now() - 45000);

console.log(ts);