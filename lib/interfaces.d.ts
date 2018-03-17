import {Subject} from "rxjs/Rx";
import {Readable} from "stream";
import {OplogStrmFilter} from "../index";
import EventEmitter = NodeJS.EventEmitter;

export interface ReadableStrmWithFilter {
  strm: Readable,
  filter: Partial<OplogStrmFilter>
}

export interface OplogInterpreterOpts {
  useEmitter: boolean,
  useObservers: boolean
}

export interface OplogInterpreter {
  ops?: {
    all: Subject<any>,
    update: Subject<Object>,
    insert: Subject<Object>,
    delete: Subject<Object>,
    errors: Subject<Object>,
    end: Subject<Object>
  },
  emitter?: EventEmitter
}