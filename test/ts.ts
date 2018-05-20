import {Timestamp} from "bson";
const ts = Timestamp.fromInt(Date.now() - 45000);
const ts2 = Timestamp.fromInt( + new Date() - 45000);
console.log(ts);
console.log(ts2);