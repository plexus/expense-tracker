import * as astring from 'astring';

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const PIGLET_PKG = "https://piglet-lang.org/packages/piglet";

function partition_n(n, args) {
    const partitions = [];
    args = Array.from(args);
    for (let i = 0 ; i<args.length; i+=n) {
        partitions.push(args.slice(i, i+n));
    }
    return partitions
}

function partition_n_step(n, step, args) {
    if (args === undefined) {
        return partition_n(n, step)
    }
    const partitions = [];
    args = Array.from(args);
    for (let i = 0 ; (i+step)<args.length; i+=step) {
        partitions.push(args.slice(i, i+n));
    }
    return partitions
}

function partition_all_n_step(n, step, args) {
    const partitions = [];
    args = Array.from(args);
    for (let i = 0 ; i<args.length; i+=step) {
        partitions.push(args.slice(i, i+n));
    }
    return partitions
}

function assert(bool, message) {
    if (!bool) {
        throw new Error("Assertion failed" + (message ? (", " + message) : ""))
    }
}

function assert_type(val, type, message) {
    if (typeof type === 'string') {
        assert(typeof val === type, message || `Expected ${val?.inspect ? val.inspect() : val} (${val?.constructor?.name || typeof val}) to be of type ${type}`);
    } else {
        assert(val.constructor == type, message || `Expected ${val} (${val?.constructor?.name || typeof val}) to be of type ${type?.name}`);
    }
}

const munge_cache = {};
const unmunge_cache = {};

/**
 * Attempt at a munging strategy which yields valid JS identifiers, and
 * which is unambiguosly reversible, i.e. does not create collisions
 */
function munge(id) {
    let munged = munge_cache[id];
    if (munged) return munged
    munged = id
        .replaceAll("$", "_$DOLLAR$_")
        .replaceAll("_", "_$UNDERSCORE$_")
        .replaceAll("-", "_")
        .replaceAll("+", "_$PLUS$_")
        .replaceAll("<", "_$LT$_")
        .replaceAll(">", "_$GT$_")
        .replaceAll("*", "_$STAR$_")
        .replaceAll("!", "_$BANG$_")
        .replaceAll("?", "_$QMARK$_")
        .replaceAll("&", "_$AMP$_")
        .replaceAll("%", "_$PERCENT$_")
        .replaceAll("=", "_$EQ$_")
        .replaceAll("|", "_$PIPE$_")
        .replaceAll("/", "_$SLASH$_")
        .replaceAll("@", "_$AT$_")
        .replaceAll(".", "$$$$");
    // .replaceAll("ː", "_$TRICOL$_")
    // .replaceAll(":", "ː") // modifier letter triangular colon U+02D0
    munge_cache[id]=munged;
    unmunge_cache[munged]=id;
    return munged
}

function unmunge(id) {
    let unmunged = unmunge_cache[id];
    if (unmunged) return unmunged
    unmunged = id
        .replaceAll("$$", ".")
        // .replaceAll("ː", ":")
        // .replaceAll("_$TRICOL$_", "ː")
        .replaceAll("_$AT$_", "@")
        .replaceAll("_$SLASH$_", "/")
        .replaceAll("_$PIPE$_", "|")
        .replaceAll("_$EQ$_", "=")
        .replaceAll("_$PERCENT$_", "%")
        .replaceAll("_$AMP$_", "&")
        .replaceAll("_$QMARK$_", "?")
        .replaceAll("_$BANG$_", "!")
        .replaceAll("_$STAR$_", "*")
        .replaceAll("_$GT$_", ">")
        .replaceAll("_$LT$_", "<")
        .replaceAll("_$PLUS$_", "+")
        .replaceAll("_", "-")
        .replaceAll("_$UNDERSCORE$_", "_")
        .replaceAll("_$DOLLAR$_", "$");
    unmunge_cache[id]=unmunged;
    munge_cache[unmunged]=id;
    return unmunged
}

function fixed_prop(o, k, v) {
    // Unfortunately defineProperty has non-negligable performance implications.
    // We'd love to make more stuff immutable, but until browsers/js-engines
    // make this faster we'll like just do a simply assignment

    // Object.defineProperty(o, k, {value: v, writable: false, enumerable: true})
    o[k]=v;
    return o
}

function fixed_props(o, kvs) {
    for (const k in kvs) {
        fixed_prop(o, k, kvs[k]);
    }
    return o
}

const gensym = (function() {
    const syms = {};
    return function gensym(str) {
        const i = (syms[str] = (syms[str] || 0) + 1);
        return Sym.parse(`${str}${i}`)
    }
})();

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const META_SYM = Symbol("piglet:lang:meta");

function assert_dict(o, v) {
    if (v === null) return
    if (v.constructor.name !== "Dict") {
        throw new Error(`Metadata must be a Dict, got ${v} ${JSON.stringify(v)} on ${o.inspect ? o.inspect() : o}`)
    }
}

function meta(o) {
    return (o && o[META_SYM]) || null
}

function has_meta(o) {
    return META_SYM in o
}

function set_meta(o, v) {
    // if (meta(o)) {
    //     console.log("ALREADY HAS META", o)
    // }
    if (v != null) {
        assert_dict(o, v);
        Object.defineProperty(o, META_SYM, {value: v, writable: false});
    }
    return o
}

function set_meta_mutable(o, v) {
    assert_dict(o, v);
    Object.defineProperty(o, META_SYM, {value: v, writable: true});
    return o
}

function set_meta_computed(o, f) {
    Object.defineProperty(o, META_SYM, {get: ()=>{const v = f(); assert_dict(o, v); return v}});
    return o
}

function reset_meta(o, v) {
    assert_dict(o, v);
    o[META_SYM] = v;
    return o
}

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const symreg = {};
function symbol_for(str) {
    return symreg[str] ||= Symbol(str)
}

function meta_arities(o) {
    const m = meta(o);
    if (m) return m.get_kw("arities")
}

const null_proto = {};

function find_proto(o) {
    if (o === null || o === undefined) return null_proto
    if (Array.isArray()) return Array.prototype

    switch (typeof o) {
    case "object":
        return Object.getPrototypeOf(o) || Object.prototype
    case "boolean":
        return Boolean.prototype
    case "number":
        return Number.prototype
    case "bigint":
        return BigInt.prototype
    case "symbol":
        return Symbol.prototype
    case "function":
        return Function.prototype
    case "string":
        return String.prototype
    }
}

function stringify_object(o) {
    if (null == o) {
        return `${o}`
    }
    if ("function" === typeof o.toJSON) {
        return `${o.toJSON()}`
    }
    if (`${o}` !== "[object Object]") {
        return `${o}`
    }
    if (Object.entries(o).length > 0) {
        return `{${
            Object.entries(o).map(([k,v])=>`${k}: ${v}`).join(", ")
        }}`
    }
    return o.toString()
}

class Protocol {
    constructor(meta, module_name, proto_name, signatures) {
        this.fullname = `${module_name}:${proto_name}`;
        this.sentinel = symbol_for(this.fullname);

        set_meta(this, meta);
        this.module_name = module_name;
        this.name = proto_name;
        this.methods = {};

        for(let signature of signatures) {
            const [method_name, arities] = signature;
            const method_fullname = `${module_name}:${proto_name}:${method_name}`;
            const arity_map = arities.reduce(
                (acc, [argv, doc])=>{
                    acc[argv.length] = {
                        name: method_name,
                        argv: argv,
                        arity: argv.length,
                        doc: doc,
                        sentinel: symbol_for(`${method_fullname}/${argv.length}`)};
                    return acc},
                {});

            this.methods[method_name] = {
                name: method_name,
                fullname: method_fullname,
                arities: arity_map
            };
            this[munge(method_name)]=function(obj) {
                let fn;
                if (fn = obj?.[arity_map[arguments.length]?.sentinel]) {
                    return fn.apply(null, arguments)
                }
                if (arguments.length === 0) {
                    throw new Error("Protocol method called without receiver.")
                }
                return this.invoke(arity_map, ...arguments)
            };
        }
    }

    intern(mod) {
        mod.intern(this.name, this);
        for (let {name, fullname, arities} of Object.values(this.methods)) {
            mod.intern(name, (obj, ...args)=>{
                const method = arities[args.length+1];
                if (!method) {
                    throw new Error(`Wrong number of arguments to protocol, got ${args.length}, expected ${Object.keys(arities)}`)
                }
                const fn = (obj && obj[method.sentinel]) || find_proto(obj)[method.sentinel];
                if (!fn) {
                    throw new Error(`No protocol method ${fullname} found in ${stringify_object(obj)} ${obj?.constructor?.name}`)
                }
                return fn(obj, ...args)
            }, {"protocol-method?": true,
                sentinel: fullname});
        }
    }

    satisfied(o) {
        if (o === null || o === undefined) {
            return !!null_proto[this.sentinel]
        }
        return !!o[this.sentinel]
    }

    extend_object(object, functions) {
        object[this.sentinel] = true;
        for (var fn of functions) {
            const method_name = unmunge(fn.name);
            const arities = meta_arities(fn) || [fn.length];
            for (const arity of arities) {
                if (Array.isArray(arity)) {
                    throw new Error(`Vararg protocol methods not yet implemented: ${method_name}`)
                }
                if (!this.methods[method_name]) {
                    throw new Error(`No method ${method_name} in ${this.fullname}, expected ${Object.getOwnPropertyNames(this.methods)}`)
                }
                if (!this.methods[method_name].arities[arity]) {
                    throw new Error(`Unknown arity for ${method_name} in ${this.fullname}, got ${arity}, expected ${Object.getOwnPropertyNames(this.methods[method_name].arities)}`)
                }
                object[this.methods[method_name].arities[arity].sentinel] = fn;
            }
        }
    }

    extend(...args) {
        for (let [klass, functions] of partition_n(2, args)) {
            const proto = klass === null ? null_proto : klass.prototype;
            this.extend_object(proto, functions);
        }
    }

    invoke(arities, obj) {
        let fn;
        const arg_count = arguments.length - 1;
        const method = arities[arg_count];
        if (!method) {
            throw new Error(`Wrong number of arguments to protocol, got ${arg_count - 1}, expected ${Object.keys(arities)}`)
        }
        fn = (obj && obj[method.sentinel]);
        if (!fn) {
            const proto = find_proto(obj); // for null and primitives
            if(!proto) {
                throw new Error(`${method.sentinel.description}: Failed to resolve prototype on ${obj.toString ? obj : JSON.stringify(obj)} ${typeof obj}`)
            }
            fn = proto[method.sentinel];
        }
        if (!fn) {
            throw new Error(`No protocol method ${method.name} found in ${stringify_object(obj)} ${obj?.constructor?.name}`)
        }
        return fn(obj, ...Array.prototype.slice.call(arguments, 2))
    }
}

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const Lookup = new Protocol(
    null, "piglet:lang", "Lookup",
    [["-get", [[["this", "k"], "Get the value associated with k, or null/undefined if absent."],
               [["this", "k", "default"], "Get the value associated with k, or default"]]]]);

// Copyright (c) Arne Brasseur 2023. All rights reserved.


class AbstractIdentifier {
    constructor(meta, sigil, name, id_str) {
        assert(id_str);
        const self = name ? ({[name](coll, fallback) {
            if (Lookup.satisfied(coll)) {
                if (fallback === undefined) {
                    return Lookup._get(coll, self)
                }
                return Lookup._get(coll, self, fallback)
            }
            fallback = fallback === undefined ? null : fallback;
            if (coll != null) {
                const n = self.fqn || self.name;
                return n in coll ? coll[n] : fallback
            }
            return fallback
        }}[name]) : (function (coll, fallback) {
            if (Lookup.satisfied(coll)) {
                if (fallback === undefined) {
                    return Lookup._get(coll, self)
                }
                return Lookup._get(coll, self, fallback)
            }
            fallback = fallback === undefined ? null : fallback;
            if (coll != null) {
                const n = self.fqn || self.name;
                return n in coll ? coll[n] : fallback
            }
            return fallback
        });

        Object.setPrototypeOf(self, this.constructor.prototype);
        fixed_prop(self, "_sigil", sigil);
        fixed_prop(self, "_id_str", id_str);
        set_meta(self, meta);
        return self
    }

    identifier_str() {
        return this._id_str
    }

    toString() {
        return `${this._sigil}${this._id_str}`
    }

    inspect() {
        return `${this.constructor.name}(${this.toString()})`
    }

    [Symbol.for('nodejs.util.inspect.custom')](depth, options, inspect) {
        return `${options.stylize(this.constructor.name, 'special')}(${options.stylize(this.toString(), 'symbol')})`
    }
}

Object.setPrototypeOf(AbstractIdentifier.prototype, Function);

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const Named = new Protocol(
    null,
    "piglet:lang",
    "Named",
    [["-name", [[["this"], "Get a string representation, used for various types of identifier objects when they need to be used in a contexts where only strings are allowed"]]]]
);

// Copyright (c) Arne Brasseur 2023. All rights reserved.


class QSym extends AbstractIdentifier {
    constructor(meta, fqn) {
        assert(fqn?.includes && fqn.includes("://"), `QSym must contain '://', got ${fqn}`);
        const url = new URL(fqn);
        const [pkg, mod] = decodeURI(url.pathname).split(":");
        const name = fqn.split(":").slice(-1)[0];
        super(meta, "", name, fqn);
        fixed_prop(this, "fqn", fqn);
        fixed_prop(this, "pkg", url.origin === "null" ? `${url.protocol}//${pkg}` : `${url.origin}${pkg}`);
        fixed_prop(this, "mod", mod);
    }

    with_meta(m) {
        return new this.constructor(m, this.fqn)
    }

    with_mod(mod_name) {
        this.constructor.parse(`${this.pkg}:${mod_name}`);
    }

    emit(cg) {
        return cg.invoke_var(
            this,
            "piglet", "lang", "qsym",
            [cg.literal(this, this.fqn)])
    }

    static parse(s) {
        return new this(null, s)
    }
}

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const CACHE = {};

/**
 * Identifier with up to three components: `pkg:mod:name`. If fewer components
 * are given, then they anchor towards the end. So `pkg` can be nil, or `pkg` and
 * `mod` can both be nil. `name` must always be present.
 *
 * Generally used to refer to a var within a module within a package, hence
 * these names. But in some places we use syms to identify modules (e.g. in a
 * module form's `:import` declaration), in which case `pkg` will be `nil`,
 * `mod` identifies a package alias, and `name` identifies the module.
 */
class Sym extends AbstractIdentifier {
    constructor(pkg, mod, name, meta) {
        assert(name, "Sym's name can not be null");
        assert(!pkg || mod, "A Sym with a package must also declare a module");

        let id_str = name;
        if (mod) id_str = mod + ":" + id_str;
        if (pkg) id_str = pkg + ":" + id_str;
        super(meta || null, "", name, id_str);

        fixed_prop(this, "pkg", pkg || null);
        fixed_prop(this, "mod", mod || null);
    }

    static parse(s, meta) {
        if (s.includes("://")) {
            return QSym.parse(s)
        }
        const [a,b,c] = s.split(":");
        if (meta == null) {
            const sym = CACHE[s];
            if (sym) return sym
        }
        const sym = (c ? new this(a,b,c, meta || null) :
                     b ? new this(null,a,b, meta || null) :
                     new this(null, null, a, meta || null));
        if (meta == null) CACHE[s] = sym;
        return sym
    }

    eq(other) {
        return (other instanceof Sym) && this.name === other.name && this.mod === other.mod && this.pkg === other.pkg
    }

    with_name(n) {
        return new this.constructor(this.pkg, this.mod, n, meta(this))
    }

    with_mod(m) {
        return new this.constructor(this.pkg, m, this.name, meta(this))
    }

    with_meta(m) {
        return new this.constructor(this.pkg, this.mod, this.name, m)
    }

    emit(cg) {
        return cg.invoke_var(
            this,
            "piglet",
            "lang",
            "symbol",
            [cg.literal(this, this.pkg),
             cg.literal(this, this.mod),
             cg.literal(this, this.name)
             //cg.emit(this, meta(this))
            ])
    }
}

function symbol(pkg, mod, name, metadata) {
    if (arguments.length === 1) {
        return Sym.parse(pkg, metadata)
    }
    return new Sym(pkg, mod, name, metadata)
}

// Copyright (c) Arne Brasseur 2023. All rights reserved.

class AbstractSeq {
    /**
     * Return the first value in the Seq, or `null` if empty
     */
    first() {
        throw new Error("Not implemented")
    }

    /**
     * Return a Seq of the remaining values beyond the first. Returns `null` if
     * there are no remaining elements.
     */
    rest() {
        throw new Error("Not implemented")
    }

    /**
     * Return `this`, or `null` if the Seq is empty. This allows us to
     * distinguish between `(nil)` and `()`
     */
    seq() {
        throw new Error("Not implemented")
    }

    empty() {
        return this.seq() === null
    }
}

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const Repr = new Protocol(
    null, "piglet:lang", "Repr",
    [["-repr", [[["this"], "Return a string representation of the object"]]]]);

// Copyright (c) Arne Brasseur 2023. All rights reserved.


class List extends AbstractSeq {
    constructor(elements) {
        super();
        this.elements = elements;
    }

    first() {
        return this.elements[0]
    }

    rest() {
        if (this.elements.length > 1) {
            return new List(this.elements.slice(1))
        }
        return null
    }

    seq() {
        return this.empty_p() ? null : this
    }

    empty_p() {
        return this.elements.length == 0
    }

    count() {
        return this.elements.length
    }

    conj(el) {
        const elements = [...this];
        elements.unshift(el);
        return new this.constructor(elements)
    }

    [Symbol.iterator]() {
        return this.elements[Symbol.iterator]()
    }

    with_meta(m) {
        return set_meta(new List(Array.from(this.elements)), m)
    }

    emit(cg) {
        return cg.invoke_var(
            this,
            "piglet",
            "lang",
            "list",
            Array.from(this, (e)=>cg.emit(this, e)))
    }

    inspect() {
        let recur = (v)=> (typeof v === 'object' || typeof v === 'function') && v?.inspect ? v.inspect() : Repr.satisfied(v) ? Repr._repr(v) : v;
        return `List(${Array.from(this, recur).join(", ")})`
    }

    [Symbol.for('nodejs.util.inspect.custom')](depth, options, inspect) {
        return `${options.stylize(this.constructor.name, 'special')}(${Array.from(this, inspect).join(",")})`
    }
}

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const Eq = new Protocol(
    null,
    "piglet:lang",
    "Eq",
    [["-eq", [[["this", "that"], "Check equality"]]]]
);

// Copyright (c) Arne Brasseur 2023. All rights reserved.


class Keyword extends AbstractIdentifier {
    constructor(meta, name) {
        assert_type(name, String, `Expected String name, got ${name.description}`);
        super(meta, ":", name, name);
    }

    with_meta(m) {
        return new this.constructor(m, this.name)
    }

    eq(other) {
        return (other instanceof Keyword) && this.name === other.name
    }

    emit(cg) {
        return cg.invoke_var(
            this,
            "piglet", "lang",
            "keyword",
            [cg.emit(this, this.name)
                // , cg.emit(this, meta(this))
            ]
        )
    }

}

function keyword(name, meta) {
    return new Keyword(meta || null, name)
}

// Copyright (c) Arne Brasseur 2023. All rights reserved.


/**
 * Naive copy-on-write dictionary backed by a frozen js Map.
 */
class Dict {
    constructor(metadata, m) {
        assert(m instanceof Map, "Dict entries has to be js:Map");
        const self = function(key, fallback) {
            if (self.has(key)) return self.get(key)
            return fallback === undefined ? null : fallback
        };
        Object.setPrototypeOf(self, this.constructor.prototype);
        fixed_prop(self, "entries", Object.freeze(m || new Map()));
        if (metadata) set_meta(self, metadata);
        return self
    }

    static of(meta, ...kvs) {
        const m = new Map();
        for (let [k, v] of partition_n(2, kvs)) {
            m.set(k, v);
        }
        return new this(meta, m)
    }

    static of_pairs(meta, kvs) {
        const m = new Map();
        for (let [k, v] of kvs) {
            m.set(k, v);
        }
        return new this(meta, m)
    }

    assoc(k, v) {
        if (this.has(k)) {
            return new Dict(meta(this), new Map(this.dissoc(k).entries).set(k, v))
        }
        return new Dict(meta(this), new Map(this.entries).set(k, v))
    }

    dissoc(k) {
        const entries = new Map(this.entries);
        if (this.entries.has(k)) {
            entries.delete(k);
        } else if (Eq.satisfied(k)) {
            for (const [kk, vv] of this.entries.entries()) {
                if (Eq._eq(k, kk)) {
                    entries.delete(kk);
                }
            }
        }
        return new Dict(meta(this), entries)
    }

    with_meta(m) {
        return new Dict(m, this.entries)
    }

    [Symbol.iterator]() {
        return this.entries[Symbol.iterator]()
    }

    has(k) {
        if (this.entries.has(k)) {
            return true
        }
        if (Eq.satisfied(k)) {
            for (const [kk, vv] of this.entries.entries()) {
                if (Eq._eq(k, kk)) {
                    return true
                }
            }
        }
        return false
    }

    get(k, fallback) {
        if (this.entries.has(k)) {
            return this.entries.get(k)
        }
        if (Eq.satisfied(k)) {
            for (const [kk, vv] of this.entries.entries()) {
                if (Eq._eq(k, kk)) {
                    return vv
                }
            }
        }
        if (fallback === undefined) {
            return null
        }
        return fallback
    }

    // HACK: For internal use. We can't construct keyword instances inside
    // Protocol.mjs because it would lead to circular dependencies
    get_kw(name) {
        return this.get(keyword(name))
    }

    keys() {
        return this.entries.keys()
    }

    values() {
        return this.entries.values()
    }

    count() {
        return this.entries.size
    }

    emit(cg) {
        return cg.invoke_var(this,
                             "piglet", "lang", "dict",
                             Array.from(this.entries).flatMap(([k, v])=>[cg.emit(this, k), cg.emit(this, v)]))
    }

    inspect() {
        let recur = (v)=> (typeof v === 'object' || typeof v === 'function') && v?.inspect ? v.inspect() : Repr.satisfied(v) ? Repr._repr(v) : v;
        return `Dict(${Array.from(this, (([k, v])=>`${recur(k)} ${recur(v)}`)).join(", ")})`
    }

    toJSON() {
        return Object.fromEntries(Array.from(this, ([k, v]) => [k.identifier_str ? k.identifier_str() : k, v]))
    }

    [Symbol.for('nodejs.util.inspect.custom')](depth, options, inspect) {
        return inspect(this.entries, options).replace(/Map/, 'Dict')
    }
}

const EMPTY$1 = new Dict(null, new Map());

Dict.EMPTY = EMPTY$1;

function dict$1(...args) { return Dict.of(null, ...args) }

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const Hashable = new Protocol(
    null,
    "piglet:lang",
    "Hashable",
    [["-hash-code", [[["this"], "Get a hash code for this object"]]]]
);

// Copyright (c) Arne Brasseur 2023. All rights reserved.


/**
 * Fully qualified identifier
 *
 * In behavior this acts exactly as a Keyword, but instead of representing a
 * simple name, it represents a fully qualified identifier in the form of a
 * URI/IRI.
 *
 * QNames function in conjunction with the `*current-context*`. Any PrefixName
 * in source code will be expanded during compilation into a QName. Conversely
 * the printer will print out QNames as PrefixNames. In either case the context
 * is consulted to find which prefixes map to which base URLs.
 *
 * QNames are mainly modeled on RDF identifiers, but we also use QNames to
 * represent XML namespaced tags. These however are two different conceptual
 * models. In RDF a prefix+suffix are combined to form a full IRI identifier. In
 * XML the namespace and tagName are not usually combined as such, but instead
 * function more like a pair. This means that for XML applications (and other
 * places where these kind of semantics are needed) we need to track what the
 * prefix and what the suffix is, and possibly add a separator between the two,
 * because XML namespaces will often not end on a `/` or `#` but simply on an
 * alphabetic character.
 *
 * Hence why we have multiple overlapping properties here.
 * - fqn: the fully qualified name as a string, most applications will only need this
 * - base / separator / suffix: the FQN split into three parts, mainly for XML
 *
 * Whether the latter ones are all set will depend on the construction. They
 * will be if the QName originates from a PrefixName, and the use of a separator
 * can be configured via the context.
 */
class QName extends AbstractIdentifier {
    constructor(meta, base, separator, suffix) {
        const fqn = `${base}${separator || ""}${suffix || ""}`;
        assert(fqn.includes("://"), "QName must contain '://'");
        super(meta, ":", fqn, fqn);
        fixed_prop(this, "fqn", fqn);
        fixed_prop(this, "base", base);
        fixed_prop(this, "separator", separator || '');
        fixed_prop(this, "suffix", suffix || '');
    }

    with_meta(m) {
        return new this.constructor(m, this.fqn)
    }

    emit(cg) {
        return cg.invoke_var(
            this,
            "piglet", "lang", "qname",
            [cg.literal(this, this.base),
             cg.literal(this, this.separator),
             cg.literal(this, this.suffix)])
    }

    static parse(s) {
        return new this(null, s)
    }
}

// Copyright (c) Arne Brasseur 2023. All rights reserved.


class PrefixName extends AbstractIdentifier {
    constructor(meta, prefix, suffix) {
        assert(prefix === null || !prefix.includes(":"), "prefix can not contain a colon");
        assert(!suffix.includes(":"), "suffix can not contain a colon");
        super(meta, ":", suffix, `${prefix || ""}:${suffix}`);
        this.prefix = prefix;
        this.suffix = suffix;
    }

    static parse(s) {
        assert(!s.includes("://"), "PrefixName can not contain '://'");
        const parts = s.split(":");
        assert(parts.length == 2, "PrefixName can only contain one colon");
        const [pre, suf] = parts;
        return new this(null, pre, suf)
    }

    emit(cg) {
        return cg.invoke_var(
            this,
            "piglet",
            "lang",
            "prefix-name",
            [this.prefix, this.suffix].map(s=>cg.literal(this, s)))
    }

    with_prefix(prefix) {
        return Object.assign(new this.constructor(this.prefix, this.suffix), this, {prefix: prefix})
    }

    with_meta(m) {
        return new this.constructor(m, this.prefix, this.suffix)
    }

    call(_, arg, fallback) {
        if (fallback === undefined) {
            return Lookup._get(arg, this)
        }
        return Lookup._get(arg, this, fallback)
    }

    inspect() {
        return `PrefixName(:${this.prefix}:${this.suffix})`
    }
}

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const default_prefixes = Dict.of_pairs(null, Object.entries({
    pkg: "https://vocab.piglet-lang.org/package/",
    dc: "http://purl.org/dc/elements/1.1/",
    dcterms: "http://purl.org/dc/terms/",
    foaf: "http://xmlns.com/foaf/0.1/",
    org: "http://www.w3.org/ns/org#",
    owl: "http://www.w3.org/2002/07/owl#",
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    schema: "http://schema.org/",
    xsd: Dict.of_pairs(null, [[keyword("base"), "http://www.w3.org/2001/XMLSchema"],
                              [keyword("separator"), "#"]]),
    svg: Dict.of_pairs(null, [[keyword("base"), "http://www.w3.org/2000/svg"],
                              [keyword("separator"), "#"]]),
    xhtml: Dict.of_pairs(null, [[keyword("base"), "http://www.w3.org/1999/xhtml"],
                                [keyword("separator"), "#"]])
}));

class Context {
    constructor() {
        throw new Error("Context is not constructible")
    }

    static expand(ctx, prefix_name) {
        let base = prefix_name.prefix || "self";
        let separator = "";
        let expanded_prefix;
        if (default_prefixes.get(base)) {
            base = default_prefixes.get(base);
        } else {
            while (expanded_prefix = ctx.get(base instanceof Dict ? base.get(keyword("base")) : base)) {
                base = expanded_prefix;
            }
        }
        [base, separator] = (base instanceof Dict ?
                             [base.get(keyword("base")), base.get(keyword("separator"))] :
                             [base, ""]
                            );
        assert(base.indexOf("://") !== -1, `PrefixName did not expand to full QName, missing prefix. ${prefix_name} in ${ctx}`);
        return new QName(meta(prefix_name), base, separator || "", prefix_name.suffix)
    }

    static contract(ctx, qname) {
        let prefix, suffix;
        for (let [k,v] of default_prefixes) {
            if (v instanceof Dict) {
                v = v.get(keyword('base'));
            }
            if (qname.fqn.startsWith(v)) {
                prefix = k;
                suffix = qname.fqn.slice(v.length);
                return new PrefixName(meta(qname), prefix == 'self' ? null : prefix, suffix)
            }
        }

        for (const [k, v] of ctx) {
            if (v instanceof Dict) {
                v = v.get(keyword('base'));
            }
            if (qname.fqn.startsWith(v)) {
                prefix = k;
                suffix = qname.fqn.slice(v.length);
                return new PrefixName(meta(qname), prefix == 'self' ? null : prefix, suffix)
            }
        }

        return qname
    }
}

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const Empty = new Protocol(
    null,
    "piglet:lang",
    "Empty",
    [["-empty?", [[["this"], "Is this an empty collection?"]]]]
);

// Copyright (c) Arne Brasseur 2023. All rights reserved.


class Cons extends AbstractSeq {
    constructor(x, xs) {
        super();
        this.x=x;
        this.xs=xs;
    }
    first() {
        return this.x
    }
    rest() {
        return Empty.satisfied(this.xs) && Empty._empty_$QMARK$_(this.xs) ?
            null : this.xs
    }
    seq() {
        return this
    }
    with_meta(m) {
        return set_meta(new Cons(this.x, this.xs), m)
    }
}

// Copyright (c) Arne Brasseur 2023. All rights reserved.


class IteratorSeq extends AbstractSeq {
    constructor(iterator, value, done) {
        super();
        this.value = value;
        this.done = done;
        this._rest = null;
        this.iterator = iterator;
    }

    static of(iterator) {
        const {value, done} = iterator.next();
        if (done) return null
        return new this(iterator, value, done)
    }

    static of_iterable(iterable) {
        return this.of(iterable[Symbol.iterator]())
    }

    first() {
        return this.value
    }

    rest() {
        if (this._rest) {
            return this._rest
        }
        const {value, done} = this.iterator.next();
        if (done) {
            return null
        }
        this._rest = new this.constructor(this.iterator, value, done);
        return this._rest
    }

    seq() {
        return this.done ? null : this
    }

    [Symbol.iterator]() {
        let head = this.seq();
        return {next: ()=>{
            if(!head) {
                return {value: null, done: true}
            }
            const ret = {value: head.value,
                         done: head.done};
            head = head.rest();
            return ret
        }}
    }
}

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const Seq = new Protocol(
    null,
    "piglet:lang",
    "Seq",
    [["-first", [[["this"], "Return the first element of the seq"]]],
     ["-rest", [[["this"], "Return a seq of the remaining elements of this seq"]]]]
);

// Copyright (c) Arne Brasseur 2023. All rights reserved.


class SeqIterator {
    constructor(seq) {
        this.seq = seq;
    }
    next() {
        if (this.seq) {
            const value = Seq._first(this.seq);
            this.seq = Seq._rest(this.seq);
            return {value: value, done: false}
        }
        return {value: void(0), done: true}
    }
    [Symbol.iterator]() {
        return this
    }
}

// Copyright (c) Arne Brasseur 2023. All rights reserved.


class Range extends AbstractSeq {
    constructor(from, to, step, meta) {
        super();
        this.from = from;
        this.to = to;
        this.step = step;
        set_meta(this, meta);
    }

    static range0() {
        return new Range(0, undefined, 1)
    }

    static range1(to) {
        return new Range(0, to, 1)
    }

    static range2(from, to) {
        return new Range(from, to, 1)
    }

    static range3(from, to, step) {
        return new Range(from, to, step)
    }

    [Symbol.iterator]() {
        if (this.to === undefined) {
            throw new Error("Can't get range iterator for infinte range")
        }
        let i = this.from;
        return {next: ()=>{
            const v = i;
            if (v < this.to) {
                i+=this.step;
                return {value: v}
            }
            return {done: true}
        }}
    }

    first() {
        if (this.to === undefined || (this.from < this.to)) {
            return this.from
        }
        return null
    }

    rest() {
        if (this.to === undefined || ((this.from + this.step) < this.to)) {
            return new Range(this.from+this.step, this.to, this.step)
        }
        return null
    }

    seq() {
        return this.empty_p() ? null : this
    }

    count() {
        if (!this.to) {
            throw new Error("Can't count infinte range")
        }
        return Math.max(0, Math.floor((this.to - this.from) / this.step))
    }

    empty_p() {
        return this.from >= this.to
    }

    inspect() {
        return `Range(${this.from}, ${this.to}, ${this.step})`
    }
}

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const Seqable = new Protocol(
    null,
    "piglet:lang",
    "Seqable",
    [["-seq", [[["this"], "Return a seq over the collection"]]]]
);

// Copyright (c) Arne Brasseur 2023. All rights reserved.


class LazySeq extends AbstractSeq {
    constructor(thunk) {
        super();
        this.thunk = thunk;
        this._seq = null;
        this.realized = false;
    }

    realize() {
        if (!this.realized) {
            this._seq = this.thunk();
            if (Empty.satisfied(this._seq) && Empty._empty_$QMARK$_(this._seq)) {
                this._seq == null;
            }
            this.realized = true;
        }
    }

    first() {
        this.realize();
        return Seq._first(this._seq)
    }

    rest() {
        this.realize();
        return Seq._rest(this._seq)
    }

    seq() {
        this.realize();
        return Seqable._seq(this._seq)
    }
}

// Copyright (c) Arne Brasseur 2023. All rights reserved.


class Repeat extends AbstractSeq {
    constructor(count, value) {
        super();
        this.count = count;
        this.value = value;
    }

    first() {
        if (this.count === null || this.count > 0) {
            return this.value
        }
        return null
    }

    rest() {
        if (this._rest === undefined) {
            if (this.count === null) {
                this._rest = this;
            } else if (this.count <= 1) {
                this._rest = null;
            } else {
                this._rest = new this.constructor(this.count-1, this.value);
            }
        }
        return this._rest
    }

    seq() {
        return this.count <= 0 ? null : this
    }

    count() {
        if (this.count) {
            return this.count
        }
        throw new Error("Can't count infinite seq")
    }
}

// Extracted from the hash-wasm project, and inlined here, with minimal JS
// WebAssembly interface, and modified to return a 32 bit integer rather than a
// hex encoded string.

// Based on: https://github.com/Daninet/hash-wasm
// Revision: bd3a205ca5603fc80adf71d0966fc72e8d4fa0ef

//// hash-wasm LICENSE file:
//
// MIT License
//
// Copyright (c) 2020 Dani Biró
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// Special thank you to the authors of original C algorithms:
//     - Alexander Peslyak <solar@openwall.com>
//     - Aleksey Kravchenko <rhash.admin@gmail.com>
//     - Colin Percival
//     - Stephan Brumme <create@stephan-brumme.com>
//     - Steve Reid <steve@edmweb.com>
//     - Samuel Neves <sneves@dei.uc.pt>
//     - Solar Designer <solar@openwall.com>
//     - Project Nayuki
//     - ARM Limited
//     - Yanbo Li dreamfly281@gmail.com, goldboar@163.comYanbo Li
//     - Mark Adler
//     - Yann Collet

const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const base64Lookup = new Uint8Array(256);
for (let i = 0; i < base64Chars.length; i++) {
    base64Lookup[base64Chars.charCodeAt(i)] = i;
}

function getDecodeBase64Length(data) {
    let bufferLength = Math.floor(data.length * 0.75);
    const len = data.length;
    if (data[len - 1] === '=') {
        bufferLength -= 1;
        if (data[len - 2] === '=') {
            bufferLength -= 1;
        }
    }
    return bufferLength;
}
function decodeBase64(data) {
    const bufferLength = getDecodeBase64Length(data);
    const len = data.length;
    const bytes = new Uint8Array(bufferLength);
    let p = 0;
    for (let i = 0; i < len; i += 4) {
        const encoded1 = base64Lookup[data.charCodeAt(i)];
        const encoded2 = base64Lookup[data.charCodeAt(i + 1)];
        const encoded3 = base64Lookup[data.charCodeAt(i + 2)];
        const encoded4 = base64Lookup[data.charCodeAt(i + 3)];
        bytes[p] = (encoded1 << 2) | (encoded2 >> 4);
        p += 1;
        bytes[p] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
        p += 1;
        bytes[p] = ((encoded3 & 3) << 6) | (encoded4 & 63);
        p += 1;
    }
    return bytes;
}


// Additional license information for xxhash32.c, which this blob is built from:

/////////////////////////////////////////////////////////////
// xxhash32.h
// Copyright (c) 2016 Stephan Brumme. All rights reserved.
// see http://create.stephan-brumme.com/disclaimer.html
//
// XXHash (32 bit), based on Yann Collet's descriptions, see
// http://cyan4973.github.io/xxHash/
//
// Modified for hash-wasm by Dani Biró
//

const wasm = decodeBase64("AGFzbQEAAAABEQRgAAF/YAF/AGAAAGACf38AAwcGAAEBAgADBAUBcAEBAQUEAQECAgYOAn8BQbCJBQt/AEGACAsHcAgGbWVtb3J5AgAOSGFzaF9HZXRCdWZmZXIAAAlIYXNoX0luaXQAAQtIYXNoX1VwZGF0ZQACCkhhc2hfRmluYWwAAw1IYXNoX0dldFN0YXRlAAQOSGFzaF9DYWxjdWxhdGUABQpTVEFURV9TSVpFAwEKswkGBQBBgAkLTQBBAEIANwOoiQFBACAANgKIiQFBACAAQc+Moo4GajYCjIkBQQAgAEH3lK+veGo2AoSJAUEAIABBqIiNoQJqNgKAiQFBAEEANgKgiQELswUBBn8CQCAARQ0AQQBBACkDqIkBIACtfDcDqIkBAkBBACgCoIkBIgEgAGpBD0sNAEEAIAFBAWo2AqCJASABQZCJAWpBAC0AgAk6AAAgAEEBRg0BQQEhAgNAQQBBACgCoIkBIgFBAWo2AqCJASABQZCJAWogAkGACWotAAA6AAAgACACQQFqIgJHDQAMAgsLIABB8AhqIQMCQAJAIAENAEEAKAKMiQEhAUEAKAKIiQEhBEEAKAKEiQEhBUEAKAKAiQEhBkGACSECDAELQYAJIQICQCABQQ9LDQBBgAkhAgNAIAItAAAhBEEAIAFBAWo2AqCJASABQZCJAWogBDoAACACQQFqIQJBACgCoIkBIgFBEEkNAAsLQQBBACgCkIkBQfeUr694bEEAKAKAiQFqQQ13QbHz3fF5bCIGNgKAiQFBAEEAKAKUiQFB95Svr3hsQQAoAoSJAWpBDXdBsfPd8XlsIgU2AoSJAUEAQQAoApiJAUH3lK+veGxBACgCiIkBakENd0Gx893xeWwiBDYCiIkBQQBBACgCnIkBQfeUr694bEEAKAKMiQFqQQ13QbHz3fF5bCIBNgKMiQELIABBgAlqIQACQCACIANLDQADQCACKAIAQfeUr694bCAGakENd0Gx893xeWwhBiACQQxqKAIAQfeUr694bCABakENd0Gx893xeWwhASACQQhqKAIAQfeUr694bCAEakENd0Gx893xeWwhBCACQQRqKAIAQfeUr694bCAFakENd0Gx893xeWwhBSACQRBqIgIgA00NAAsLQQAgATYCjIkBQQAgBDYCiIkBQQAgBTYChIkBQQAgBjYCgIkBQQAgACACayIBNgKgiQEgAUUNAEEAIQEDQCABQZCJAWogAiABai0AADoAACABQQFqIgFBACgCoIkBSQ0ACwsLzAICAX4Gf0EAKQOoiQEiAKchAQJAAkAgAEIQVA0AQQAoAoSJAUEHd0EAKAKAiQFBAXdqQQAoAoiJAUEMd2pBACgCjIkBQRJ3aiECDAELQQAoAoiJAUGxz9myAWohAgsgAiABaiECQZCJASEBQQAoAqCJASIDQZCJAWohBAJAIANBBEgNAEGQiQEhBQNAIAUoAgBBvdzKlXxsIAJqQRF3Qa/W074CbCECIAVBCGohBiAFQQRqIgEhBSAGIARNDQALCwJAIAEgBEYNACADQZCJAWohBQNAIAEtAABBsc/ZsgFsIAJqQQt3QbHz3fF5bCECIAUgAUEBaiIBRw0ACwtBACACQQ92IAJzQfeUr694bCIBQQ12IAFzQb3cypV8bCIBQRB2IAFzIgFBGHQgAUEIdEGAgPwHcXIgAUEIdkGA/gNxIAFBGHZycq03A4AJCwYAQYCJAQtTAEEAQgA3A6iJAUEAIAE2AoiJAUEAIAFBz4yijgZqNgKMiQFBACABQfeUr694ajYChIkBQQAgAUGoiI2hAmo2AoCJAUEAQQA2AqCJASAAEAIQAwsLCwEAQYAICwQwAAAA");

const {instance} = await WebAssembly.instantiate(wasm);

const {memory, Hash_Init, Hash_Update, Hash_Final, Hash_GetBuffer} = instance.exports;

/**
 * Hash a uint8array
 */
function hash_bytes(uint8) {
    const mem = new Uint8Array(memory.buffer, Hash_GetBuffer(), uint8.byteLength);
    mem.set(uint8);
    Hash_Init(0);
    Hash_Update(uint8.byteLength);
    Hash_Final();
    return new Uint32Array(mem.buffer,mem.byteOffset,1)[0]
}

const text_encoder = new TextEncoder();

/**
 * Hash a string
 */
function hash_str(s) {
    const mem = new Uint8Array(memory.buffer, Hash_GetBuffer(), s.length*3);
    const {read} = text_encoder.encodeInto(s, mem);
    Hash_Init(0);
    Hash_Update(read);
    Hash_Final();
    return new Uint32Array(mem.buffer,mem.byteOffset,1)[0]
}

function hash_num(num) {
    return hash_bytes(new Uint8Array(new Float64Array([num]).buffer))
}

// https://stackoverflow.com/a/27952689/1891448
// https://www.boost.org/doc/libs/1_55_0/doc/html/hash/reference.html#boost.hash_combine
function hash_combine(seed, hash) {
    return seed ^ hash + 0x9e3779b9 + (seed << 6) + (seed >> 2);
}

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const HASH_CACHE = new WeakMap();
// Symbols don't generally work in weakmaps yet, and they are frozen so we can't
// cache the hash on the symbol object... so we keep them all. Not ideal,
// potential memory leak.
const SYMBOL_HASH_CACHE = {};

function hash_code(o) {
    if (o == null) return 0
    const t = typeof o;
    if ("object" === t || "function" === t) {
        // This doesn't seem to be generally supported yet.
        // https://github.com/tc39/proposal-symbols-as-weakmap-keys
        // || ("symbol" === t && "undefined" === typeof Symbol.keyFor(o))) {

        if (HASH_CACHE.has(o)) {
            return HASH_CACHE.get(o)
        }
        const hsh = Hashable._hash_code(o);
        HASH_CACHE.set(o, hsh);
        return hsh
    }

    if ("symbol" === t) {
        if (o in SYMBOL_HASH_CACHE) {
            return SYMBOL_HASH_CACHE[o]
        }
        return SYMBOL_HASH_CACHE[o] = Hashable._hash_code(o)
    }

    return Hashable._hash_code(o)
}

// Copyright (c) Arne Brasseur 2023. All rights reserved.


function eq$1(thiz, that) {
    if (thiz === that) return true
    if (hash_code(thiz) !== hash_code(that)) return false
    if (Eq.satisfied(thiz)) return Eq._eq(thiz, that)
    return false
}

function arr_has(arr, o) {
    for (const a of arr) {
        if (eq$1(a, o)) return true
    }
    return false
}

function madd(m, o) {
    const hsh = hash_code(o);
    if (!m.has(hsh)) m.set(hsh, []);
    const bucket = m.get(hsh);
    if (!arr_has(bucket, o))
        bucket.push(o);
    return m
}

function mremove(m, o) {
    const hsh = hash_code(o);
    if (m.has(hsh)) {
        m.set(hsh, m.get(hsh).filter((x)=>!eq$1(x,o)));
    }
    return m
}

function mhas(m, o) {
    const hsh = hash_code(o);
    if(m.has(hsh))
        for (const x of m.get(hsh))
            if (eq$1(x,o)) return true
    return false
}

/**
 * Naive copy-on-write set by a frozen js Map. Placeholder since it doesn't
 * properly honour Piglet value semantics on keys, but works ok with keywords
 * since we intern those.
 */
class HashSet {
    constructor(metadata, m) {
        assert(m instanceof Map, "HashSet entries has to be js:Map");
        const self = function(value, fallback) {
            if (self.has(value)) return value
            return fallback === undefined ? null : fallback
        };
        Object.setPrototypeOf(self, this.constructor.prototype);
        fixed_prop(self, "entries", Object.freeze(m || new Map()));
        if (metadata) {
            set_meta(self, metadata);
        }
        self._count = Array.from(self.entries.values()).reduce((acc,bucket)=>acc+bucket.length, 0);
        return self
    }

    static of(meta, ...values) {
        const m = new Map();
        for (const o of values) madd(m, o);
        return new this(meta, m)
    }

    conj(o) {
        if (this.has(o)) return this
        return new HashSet(meta(this), madd(new Map(this.entries), o))
    }

    disj(o) {
        if (this.has(o)) return new HashSet(meta(this), mremove(new Map(this.entries), o))
        return this
    }

    with_meta(m) {
        return new HashSet(m, this.entries)
    }

    [Symbol.iterator]() {
        const map_it = this.entries[Symbol.iterator]();
        let map_res = map_it.next();
        let bucket_it = null;
        let bucket_res = null;
        const next = function next() {
            // Get a new bucket_it, or decide that we're done
            if (!bucket_it || bucket_res.done) {
                if (map_res.done) {
                    return {done: true}
                }
                bucket_it = map_res.value[1][Symbol.iterator]();
                map_res = map_it.next();
            }
            // at this point we must have a bucket iterator
            bucket_res = bucket_it.next();
            // We're at the end of the bucket, retry with the next
            if (bucket_res.done) return next()
            return bucket_res
        };
        return {next: next}
    }

    has(o) {
        return mhas(this.entries, o)
    }

    count() {
        return this._count
    }

    emit(cg) {
        return cg.invoke_var(this,
            "piglet", "lang", "set-ctor",
            [
                cg.emit(this, meta(this) || null),
                ...Array.from(this).map((o)=>cg.emit(this, o))
            ])
    }

    inspect() {
        let recur = (v)=> (typeof v === 'object' || typeof v === 'function') && v?.inspect ? v.inspect() : Repr.satisfied(v) ? Repr._repr(v) : v;
        return `HashSet(${Array.from(this, ((o)=>`${recur(o)}`)).join(", ")})`
    }

    toJSON() {
        return Array.from(this.entries.values).reduce((acc, bucket)=>acc+bucket, [])
    }
}

const EMPTY = new HashSet(null, new Map());

HashSet.EMPTY = EMPTY;

function set(coll) { return HashSet.of(meta(coll), ...(coll || [])) }

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const WithMeta = new Protocol(
    null,
    "piglet:lang",
    "WithMeta",
    [["-with-meta", [[["this", "meta"], "Return a version of the value with the new metadata associated with it."]]]]
);

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const Associative = new Protocol(
    null,
    "piglet:lang",
    "Associative",
    [["-assoc", [[["this", "k", "v"], "Associate the given value with the given key"]]],
     ["-dissoc", [[["this", "k"], "Remove the association between the thegiven key and value"]]]]);

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const NO_READ=Symbol("NO_READ");

/**
 * Wrapper for primitive values, so we can store location information on them.
 */
// FIXME get rid of these, just use JS wrapper objects and set metadata on them
class Primitive {
    constructor(raw, value) {
        this.raw = raw;
        this.value = value;
    }

    repr() {
        return this.raw
    }

    toString() {
        return this.raw
    }

    emit(cg) {
        if (Array.isArray(this.value)) {
            return cg.array_literal(this, this.value.map(v=>cg.emit(this, v)))
        }
        return cg.literal(this, this.value, this.raw)
    }

    [Symbol.valueOf]() {
        return this.value
    }
}

Repr.extend(Primitive, [function _repr(self) { return self.repr() }]);

function char_seq(s) {
    return s.split("").map(ch=>ch.charCodeAt(0))
}

const ch_0 = "0".charCodeAt(0);
const ch_9 = "9".charCodeAt(0);
const ch_A = "A".charCodeAt(0);
const ch_Z = "Z".charCodeAt(0);
const ch_a = "a".charCodeAt(0);
const ch_r = "r".charCodeAt(0);
const ch_x = "x".charCodeAt(0);
const ch_z = "z".charCodeAt(0);
const ch_caret = "^".charCodeAt(0);
const ch_dash = "-".charCodeAt(0);
const ch_underscore = "_".charCodeAt(0);
const ch_dubquot = "\"".charCodeAt(0);
const ch_quot = "'".charCodeAt(0);
const ch_hash = "#".charCodeAt(0);
const ch_lparen = "(".charCodeAt(0);
const ch_rparen = ")".charCodeAt(0);
const ch_lbracket = "[".charCodeAt(0);
const ch_rbracket = "]".charCodeAt(0);
const ch_lbrace = "{".charCodeAt(0);
const ch_rbrace = "}".charCodeAt(0);
const ch_slash = "/".charCodeAt(0);
const ch_colon = ":".charCodeAt(0);
const ch_at = "@".charCodeAt(0);
const ch_semicolon = ";".charCodeAt(0);
const ch_backslash = "\\".charCodeAt(0);
const ch_period = ".".charCodeAt(0);
const ch_percent = "%".charCodeAt(0);
const whitespace_chars = char_seq(" \r\n\t\v,");
const sym_initials = char_seq("+-_|!?$<>.*=<>/:&");
const sym_chars = char_seq("+-_|!?$<>.*%=<>/:&#");
const ch_backtick = "`".charCodeAt(0);
const ch_tilde = "~".charCodeAt(0);

const delim_pairs = {
    "(": ")",
    "{": "}",
    "[": "]",
    "<": ">",
};

const string_escapes = {
    "0": "\0",
    "n": "\n",
    "t": "\t",
    "r": "\r",
    "v": "\v",
    "b": "\b",
    "f": "\f",
};

class PartialParse extends Error {}

class StringReader {
    constructor(input, filename, data_readers) {
        this.input = input;
        this.filename = filename;
        this.pos = -1;
        this.limit = input.length;
        this.line = 1;
        this.col = -1;
        this.ch = null;
        this.cc = null;
        this.meta_stack = [];
        this.line_offset = 0;
        this.start_offset = 0;
        this.data_readers = data_readers || {};
    }

    eof() {
        return this.limit <= this.pos || this.limit === 0
    }

    next_ch(should_throw) {
        if (this.eof()) {
            if (should_throw) {
                throw new Error("Unexpected end of input")
            } else {
                return
            }
        }
        this.pos++;
        this.col++;
        if (this.cc === 10) {
            this.line++;
            this.col = 0;
        }
        this.ch = this.input[this.pos];
        this.cc = this.input.charCodeAt(this.pos);
    }

    prev_ch() {
        if (this.pos > -1) {
            this.pos--;
            this.col--;
            this.ch = this.input[this.pos];
            this.cc = this.input.charCodeAt(this.pos);
        }
    }

    reset() {
        this.pos = -1;
        this.line = 0;
        this.col = -1;
        this.limit = this.input.length;
        this.ch = null;
        this.cc = null;
    }

    append(s) {
        const eof = this.eof();
        this.input+=s;
        this.limit+=s.length;
        if (eof) this.prev_ch();
    }

    empty() {
        this.input = "";
        this.pos = 0;
        this.line = 0;
        this.col = 0;
        this.limit = 0;
        this.ch = null;
        this.cc = null;
    }

    truncate() {
        this.input = this.input.slice(this.pos);
        this.pos = -1;
        this.line = 0;
        this.col = 0;
        this.limit = this.input.length;
    }

    skip_char(cc) {
        if (this.eof()) {
            throw new PartialParse()
        }
        if (this.cc !== cc) {
            throw new Error("Unexpected input " + this.ch + ", expected " + String.fromCodePoint(cc))
        }
        this.next_ch();
    }

    skip_ws() {
        if (this.eof()) return
        while (whitespace_chars.includes(this.cc)) {
            this.next_ch();
        }
    }

    skip_comment() {
        if (this.eof()) return
        while (this.cc !== 10) {
            this.next_ch();
        }
        this.next_ch();
    }

    skip_blank() {
        this.skip_ws();
        while (!this.eof() && this.cc === ch_semicolon) {
            this.skip_comment();
            this.skip_ws();
        }
    }

    _read() {
        if (this.pos === -1) {
            this.next_ch();
        }
        this.skip_blank();
        if (this.eof()) {
            return null
        } else if (this.cc === ch_caret) {
            this.next_ch();
            let next_meta = this.meta_stack[0];
            const new_meta = this._read();
            if (new_meta instanceof Sym) {
                next_meta = Associative._assoc(next_meta, keyword("tag"), new_meta);
            } else if (new_meta instanceof Keyword) {
                next_meta = Associative._assoc(next_meta, new_meta, true);
            } else if (new_meta instanceof Dict) {
                next_meta = Array.from(new_meta).reduce((acc, [k, v])=>Associative._assoc(acc, k, v), next_meta);
            }
            this.meta_stack[0] = next_meta;
            return this._read()
        } else if (this.cc === ch_hash) {
            this.next_ch();
            if (this.cc === ch_underscore) {
                this.next_ch();
                this.read();
                return NO_READ
            } else if (this.cc === ch_lbrace) {
                return this.read_set()
            } else if (this.cc === ch_quot) {
                this.next_ch();
                return new List([Sym.parse("var"), this.read_symbol()])
            } else {
                const tag = this.read_symbol().toString();
                if ("js" === tag) {
                    const val = this._read();
                    if (val instanceof Dict) {
                        const ret = {};
                        for (let [k, v] of val) {
                            ret[k instanceof AbstractIdentifier ? k.identifier_str() : k] = v;
                        }
                        return ret
                    }
                    if (Array.isArray(val)) {
                        // FIXME: will have to change once we have real vectors
                        return val
                    }
                }
                const reader = this.data_readers[tag];
                if (reader) {
                    return reader(this._read())
                }
                throw new Error(`Unsupported reader dispatch #${tag}`)
            }
        } else if (this.cc === ch_colon) {
            return this.read_name()
        } if (ch_0 <= this.cc && this.cc <= ch_9) {
            return this.read_number()
        } else if (ch_dash === this.cc) {
            this.next_ch();
            if (ch_0 <= this.cc && this.cc <= ch_9) {
                this.prev_ch();
                return this.read_number()
            } else {
                this.prev_ch();
                return this.read_symbol()
            }
        } else if (this.cc === ch_percent) {
            return this.read_percent_form()
        } else if ((ch_a <= this.cc && this.cc <= ch_z)
                   || (ch_A <= this.cc && this.cc <= ch_Z)
                   || sym_initials.includes(this.cc)) {
            return this.read_symbol()
        } else if (this.cc === ch_lparen) {
            return this.read_list()
        } else if (this.cc === ch_lbracket) {
            return this.read_vector()
        } else if (this.cc === ch_lbrace) {
            return this.read_dict()
        } else if (this.cc === ch_dubquot) {
            return this.read_string()
        } else if (this.cc === ch_quot) {
            this.next_ch();
            return new List([Sym.parse("quote"), this.read()])
        } else if (this.cc === ch_at) {
            this.next_ch();
            return new List([Sym.parse("deref"), this.read()])
        } else if (this.cc === ch_semicolon) {
            this.skip_comment();
            return this._read()
        } else if (this.cc === ch_backtick) {
            this.next_ch();
            return new List([Sym.parse("syntax-quote"), this.read_with_meta()])
        } else if (this.cc === ch_tilde) {
            this.next_ch();
            if (this.cc === ch_at) {
                this.next_ch();
                return new List([Sym.parse("unquote-splice"), this.read_with_meta()])
            }
            return new List([Sym.parse("unquote"), this.read_with_meta()])
        }
        throw new Error(`not recognized ${this.ch}  @${this.pos}`)
    }

    read_with_meta() {
        this.skip_blank();
        let start = this.pos + this.start_offset;
        let col = this.col;
        let line = this.line + this.line_offset;
        this.meta_stack.unshift(dict$1(
            keyword("start"), start,
            keyword("col"), col,
            keyword("line"), Math.max(line,1),
        ));
        if (this.filename) {
            this.meta_stack.unshift(
                Associative._assoc(this.meta_stack.shift(), keyword("file"), this.filename));

        }
        let expr = this._read();
        if (expr === NO_READ) {
            this.meta_stack.shift();
            return NO_READ;
        }
        if (expr && (typeof expr === 'object' || typeof expr === 'function')) {
            const m = Associative._assoc(this.meta_stack.shift(), keyword("end"), this.pos);
            if (WithMeta.satisfied(expr)) {
                expr = WithMeta._with_meta(expr, m);
            } else if (expr && typeof expr === 'object') {
                if (has_meta(expr)) ; else {
                    set_meta(expr, m);
                }
            }
        } else {
            this.meta_stack.shift();
        }
        return expr
    }

    read() {
        const expr = this.read_with_meta();
        if (expr === NO_READ) return null
        return expr
    }

    read_number_base(base) {
        const start = this.pos;
        if (base <= 10) {
            while (!this.eof() && ch_underscore === this.cc || (ch_0 <= this.cc && this.cc < ch_0 + base))
                this.next_ch();
        } else {
            while (!this.eof() &&
                   ch_underscore === this.cc ||
                   (ch_0 <= this.cc && this.cc <= ch_9) ||
                   (ch_a <= this.cc && this.cc < ch_a + (base - 10)) ||
                   (ch_A <= this.cc && this.cc < ch_A + (base - 10)))
                this.next_ch();
        }
        const num_str = this.input.substring(start, this.pos);
        return parseInt(num_str.replaceAll("_", ""), base)
    }

    read_number() {
        const start = this.pos;
        if (ch_dash === this.cc) {
            this.next_ch();
            return -this.read_number()
        }
        if (ch_0 === this.cc && ch_x === this.input.charCodeAt(this.pos+1)) {
            this.next_ch();
            this.next_ch();
            return this.read_number_base(16)
        }
        const num = this.read_number_base(10);
        if (!this.eof() && ch_period === this.cc) {
            this.next_ch();
            this.read_number_base(10);
            const num_str = this.input.substring(start, this.pos);
            return parseFloat(num_str.replace("_", ""), 10)
        }
        if (!this.eof() && ch_r === this.cc) {
            this.next_ch();
            return this.read_number_base(num)
        }
        return num
    }

    string_next(result) {
        if (ch_backslash === this.cc) {
            this.next_ch(true);
            if (this.ch in string_escapes) {
                result = `${result}${string_escapes[this.ch]}`;
            } else if (this.ch === "u") {
                this.next_ch(true);
                let ustart = this.pos;
                let uhex = null;
                if (this.ch === "{") {
                    ustart += 1;
                    while (this.ch != "}") { this.next_ch(true); }
                    uhex = this.input.slice(ustart, this.pos);
                } else {
                    this.next_ch(true);
                    this.next_ch(true);
                    this.next_ch(true);
                    uhex = this.input.slice(ustart, this.pos+1);
                }
                result += String.fromCodePoint(parseInt(uhex, 16));
            } else {
                result = `${result}${this.ch}`;
            }
            this.next_ch();
        } else {
            result = `${result}${this.ch}`;
            this.next_ch();
        }
        return result
    }

    read_string() {
        this.pos;
        let result = "";
        this.next_ch();
        while (!this.eof() && ch_dubquot != this.cc) {
            result = this.string_next(result);
        }
        this.skip_char(ch_dubquot);
        return result
    }

    read_percent_form() {
        this.pos;
        let pattern = "";
        this.next_ch();
        if (ch_percent === this.cc || (ch_0 <= this.cc && this.cc <= ch_9)) {
            return Sym.parse(`%${this.ch}`)
        }
        const type = this.ch;
        assert(type === "q" || type === "r" || type === "w", "Percent must be followed by q, r, w, %, or a number");
        this.next_ch();
        const closing_delim = (delim_pairs[this.ch] || this.ch).charCodeAt(0);
        this.next_ch();
        while (!this.eof() && closing_delim != this.cc) {
            if (type === "q") {
                pattern = this.string_next(pattern);
            } else {
                pattern += this.ch;
                this.next_ch();
                if (ch_backslash === this.cc) {
                    this.next_ch();
                    if (closing_delim === this.cc) {
                        pattern += this.ch;
                        this.next_ch();
                    } else {
                        pattern += "\\";
                    }
                }
            }
        }
        this.skip_char(closing_delim);
        switch(type) {
        case "r":
            let modifiers = "";
            while (!this.eof() && this.ch === "g" || this.ch === "m" || this.ch === "i" || this.ch === "m" || this.ch === "x") {
                // Emulate "freespacing mode" (x)
                // https://www.regular-expressions.info/freespacing.html
                // Not present in JS, but doesn't mean we can't support it. This
                // is going to need some finetuning, as generally 'x' is a bit
                // more picky about where you put your whitespace, so it doesn't
                // mess up regex tokens like (<? ) etc., but if you use it as
                // intended this should go a long way. Note that if we follow
                // Java's flavor of this, then we have less special casing to
                // do, since Java also strips whitespace within [...]
                if (this.ch === "x") {
                    pattern = pattern
                        .replace(/(?<!\\)#.*/g, '')  // strip comments ('#' til end of line, if not preceded by backslash)
                        .replace(/(?<!\\)\s/g, '')   // strip whitespace (if not preceded by backslash)
                        .replace(/\\(?=[\s#])/, ''); // remove backslashes in front of '#' and whitespace
                } else {
                    modifiers += this.ch;
                }
                this.next_ch();
            }
            return new RegExp(pattern, modifiers)
        case "q":
            return pattern
        case "w":
            return pattern.trim().split(/\s+/)
        }
    }

    read_symbol() {
        const start = this.pos;
        while (!this.eof() &&
               (ch_a <= this.cc && this.cc <= ch_z ||
                ch_A <= this.cc && this.cc <= ch_Z ||
                ch_0 <= this.cc && this.cc <= ch_9 ||
                ch_slash === this.cc ||
                ch_at === this.cc || // @ allowed as non-initial
                sym_chars.includes(this.cc))) {
            this.next_ch();
        }
        const s = this.input.substring(start, this.pos);
        if (s.includes("://")) return QSym.parse(s)
        switch(s) {
        case("nil"): return null
        case("undefined"): return undefined
        case("true"): return true
        case("false"): return false
        default: return Sym.parse(s)
        }
    }

    read_sequence(end_ch) {
        const elements = [];
        this.next_ch();
        this.skip_blank();
        while (!this.eof() && !(this.cc === end_ch)) {
            const el = this.read_with_meta();
            if (el !== NO_READ) {
                elements[elements.length] = el;
            }
            this.skip_blank();
        }
        this.skip_char(end_ch);
        return elements
    }

    read_list() {
        return new List(this.read_sequence(ch_rparen))
    }

    read_vector() {
        // currently just returns an Array
        return this.read_sequence(ch_rbracket)
    }

    read_dict() {
        const kvs = this.read_sequence(ch_rbrace);
        return dict$1(...kvs)
    }

    read_set() {
        const vals = this.read_sequence(ch_rbrace);
        return HashSet.of(null, ...vals)
    }

    read_name() {
        this.next_ch();
        if (this.cc === ch_colon) {
            this.next_ch();
            const s = this.read_symbol();
            assert(!s.mod);
            return new PrefixName(null, null, s.name)
        }
        let s = (this.cc === this.ch_dubquot) ? this.read_string() : this.read_symbol().toString();
        if (s.includes("://")) return new QName(null, s)
        if (s.includes(":")) return PrefixName.parse(s)
        return keyword(s)
    }
}

// Copyright (c) Arne Brasseur 2023. All rights reserved.


class Var {
    constructor(pkg, module, name, value, _meta) {
        const self = {[name](...args) {
            try {
                return self.value(...args)
            } catch (e) {
                if (typeof e === 'object') {
                    e.stack = `    at ${self.repr()} ${Repr._repr(meta(self))}\n${e.stack}`;
                }
                throw e
            }
        }}[name];
        Object.setPrototypeOf(self, Var.prototype);
        self.fqn = new QSym(null, `${pkg}:${module}:${name}`);
        self.pkg = pkg;
        self.module = module;
        self.value = value;
        self.binding_stack = [];
        // self.global_name = next_global_name()
        // GLOBAL[self.global_name] = self
        set_meta_mutable(self, _meta);
        return self
    }

    deref() {
        return this.value
    }

    set_value(value) {
        this.value = value;
        return this
    }

    push_binding(value) {
        this.binding_stack.unshift(this.value);
        this.value = value;
    }

    pop_binding() {
        this.value = this.binding_stack.shift();
    }

    repr() {
        return `#'${this.module}:${this.name}`
    }

    toString() {
        return this.repr()
    }

    inspect() {
        return `Var(${this.toString()})`
    }
}

Object.setPrototypeOf(Var.prototype, Function);

// Copyright (c) Arne Brasseur 2023. All rights reserved.


class Module {
    constructor(opts) {
        this.required = false;
        this.set_opts(opts);
    }

    set_opts(opts) {
        const name = opts?.get("name");
        const pkg = opts.get("package");
        assert(pkg, opts);
        fixed_prop(this, "package", pkg);
        fixed_prop(this, "pkg", pkg.name);
        fixed_prop(this, "name", name);
        fixed_prop(this, "munged_id", munge(name));
        fixed_prop(this, "fqn", QSym.parse(`${pkg.name}:${name}`));
        fixed_prop(this, "imports", opts?.get("imports") || []);
        fixed_prop(this, "aliases", {});
        fixed_prop(this, "vars", {});

        this.self_ref = gensym(`mod-${name}`);

        if (opts.get('location')) {
            this.location = opts.get('location');
        }

        for (const {alias, from} of this.imports) {
            this.set_alias(alias.name, from);
        }
        this.context = (opts?.get("context") || dict$1()).assoc("self", this.pkg);
        set_meta_computed(this, ()=>dict$1(keyword("file"), this.location,
                                         keyword("start"), 0));
    }

    /**
     * Takes the current package name (string), and a `(module ...)` form, and
     * returns a dict with parsed module attributes (as string keys)
     * - name
     * - imports
     * - context
     */
    static parse_opts(current_pkg, form) {
        const [_, name, ...more] = form;
        // console.log(`Module.parse_opts(${current_pkg}, ${name.inspect()})`)
        let opts = dict$1("name", name.name, "imports", [], "context", null);
        for (let [kw,...vals] of more) {
            if (kw.name == "import") {
                for (let val of vals) {
                    if (Array.isArray(val)) {
                        let [alias, ...pairs] = val;
                        let i = {alias: alias};
                        for (let [k, v] of partition_n(2, pairs)) {
                            i[k.name] = v;
                        }
                        opts.get("imports").push(i);
                    } else {
                        opts.get("imports").push({
                            alias: symbol(val.name),
                            from: val
                        });
                    }
                }
            }
            if (kw.name == "context") {
                opts = opts.assoc("context", vals[0]);
            }
        }
        return opts
    }

    static from(pkg, form) {
        // console.log(`Module.from(${pkg}, ${Array.from(form)[1].inspect()})`)
        return new this(this.parse_opts(pkg, form))
    }

    merge_opts(opts) {
        Object.assign(this.imports, opts?.get("imports"));
        for (const {alias, from} of this.imports) {
            this.set_alias(alias.name, from);
        }
        this.context = (opts?.get("context") || dict$1()).assoc("self", `${this.pkg}#`);
    }

    resolve(name) {
        // console.log("Resolving", this.repr(), name, !! this.vars[munge(name)])
        return this.vars[munge(name)]
    }

    ensure_var(name, meta) {
        const munged = munge(name);
        if (!Object.hasOwn(this.vars, name)) {
            this.vars[munged] = new Var(this.pkg, this.name, name, null, null, meta);
        }
        return this.vars[munged]
    }

    intern(name, value, meta) {
        const the_var = this.ensure_var(name, meta);
        the_var.set_value(value);
        if (meta !== undefined) {
            if (meta?.constructor == Object) {
                meta = Object.entries(meta).reduce((acc,[k,v])=>acc.assoc(k, v), dict$1());
            }
            reset_meta(the_var, meta);
        }
        return the_var
    }

    has_var(name) {
        return !!this.vars[munge(name)]
    }

    set_alias(alias, mod) {
        assert_type(mod, Module, `Alias should point to Module, got ${mod?.constructor || typeof mod}`);
        this.aliases[alias] = mod;
        if (mod.is_js_import && mod.resolve("default")) {
            this.intern(alias, mod.resolve("default").value);
        } else if (!this.has_var(alias)) {
            this.intern(alias, mod);
        }
    }

    resolve_alias(alias) {
        return this.aliases[alias]
    }

    repr() {
        return `${this.pkg}:${this.name}`
    }

    static munge(id) {return munge(id)}
    static unmunge(id) {return unmunge(id)}

    inspect() {
        return `Module(${this.pkg}:${this.name})`
    }

    // DictLike
    keys() { return Array.from(Object.keys(this.vars), (k)=>new Sym(null, null, unmunge(k), null))}
    values() { return Object.values(this.vars)}
    lookup(k) { return this.vars[munge(k)] }
    seq() {
        if (Object.keys(this.vars).length === 0) return null
        return Array.from(Object.entries(this.vars), ([k, v])=>[new Sym(null, null, unmunge(k), null), v])
    }
}

// Copyright (c) Arne Brasseur 2023. All rights reserved.


class Package {
    constructor(name) {
        fixed_props(
            this,
            {name: name,
             modules: {},
             aliases: {},
             index: {}});
        fixed_prop(this.aliases, 'piglet', PIGLET_PKG);
    }

    find_module(mod) {
        if (typeof mod === 'string') {
            const munged_mod = munge(mod);
            if (munged_mod in this.modules) {
                return this.modules[munged_mod]
            }
            return null
        }
        throw `Unexpected type ${mod?.constructor || typeof mod}`
    }

    ensure_module(mod) {
        const munged = munge(mod);
        if (!(munged in this.modules)) {
            const module = new Module(dict$1("package", this, "pkg", this.name, "name", mod));
            this.modules[munged] = module;
            this.index[munged] = module.vars;
        }
        return this.modules[munged]
    }

    add_alias(from, to) {
        assert(!(from in this.aliases));
        this.aliases[from] = to;
    }

    resolve_alias(alias) {
        const resolved = this.aliases[alias];
        assert(resolved, `Alias ${alias} not found in ${this.name} ${this.aliases}`);
        return resolved
    }
}

// Copyright (c) Arne Brasseur 2023. All rights reserved.


function qname$1(s) { return QName.parse(s) }

const pkg$name$1 = qname$1('https://vocab.piglet-lang.org/package/name');
const pkg$deps = qname$1('https://vocab.piglet-lang.org/package/deps');
const pkg$location$1 = qname$1('https://vocab.piglet-lang.org/package/location');
const pkg$paths = qname$1('https://vocab.piglet-lang.org/package/paths');

class ModuleRegistry {
    constructor() {
        fixed_props(this, {packages: {}, index: {}});
        const piglet_lang = this.ensure_module(PIGLET_PKG, "lang");
        this.current_module = piglet_lang.ensure_var("*current-module*");
    }

    static instance() {
        return this._instance ||= new this()
    }

    find_package(name) {
        assert(name.includes('://') && new URL(name).pathname.indexOf(":") === -1,
               `Package name must be single segment URI, got ${name}`);
        return this.packages[name]
    }

    ensure_package(name) {
        assert(name.includes('://') && new URL(name).pathname.indexOf(":") === -1,
               `Package name must be single segment URI, got ${name}`);
        if (!(name in this.packages)) {
            const pkg = new Package(name);
            this.packages[name] = pkg;
            fixed_prop(this.index, name, pkg.index);
        }
        return this.packages[name]
    }

    package_from_spec(pkg_spec) {
        const pkg_name = pkg_spec.get(pkg$name$1);
        const pkg = this.ensure_package(pkg_name.toString());
        pkg.paths = pkg_spec.get(pkg$paths) || [];
        pkg.deps = pkg_spec.get(pkg$deps) || dict$1();
        pkg.location = pkg_spec.get(pkg$location$1).toString();
        return pkg
    }

    find_module(pkg, mod) {
        [pkg, mod] = this.split_mod_name(pkg, mod);
        return this.packages[pkg]?.find_module(mod)
    }

    ensure_module(pkg, mod) {
        [pkg, mod] = this.split_mod_name(pkg, mod);
        const module = this.ensure_package(pkg).ensure_module(mod);
        if (!(pkg == PIGLET_PKG && mod == "lang")) {
            Object.setPrototypeOf(module.vars, this.find_module(PIGLET_PKG, "lang").vars);
        }
        return module
    }

    resolve_module(current_package_name, from) {
        const current_package = this.ensure_package(current_package_name);
        if (typeof from === 'string') {
            return this.ensure_module(current_package_name, `js-interop/${from.replace(':', '__')}`)
        } else if (from instanceof Sym) {
            if (from.mod) {
                return this.ensure_module(current_package.aliases[from.mod], from.name)
            } else {
                return this.ensure_module(current_package_name, from.name)
            }
        } else if (from instanceof QSym) {
            return this.ensure_module(from)
        } else {
            throw new Error(`Bad type for :from ${from} ${from?.constructor?.name || typeof from}`)
        }
    }

    register_module({pkg, name, imports, context, location, self_ref}) {
        const mod = this.ensure_module(pkg, name);
        while(mod.imports.shift()) {}
        Object.keys(mod.aliases).forEach((k)=>delete mod.aliases[k]);
        for (const {alias, from} of imports) {
            const import_mod = this.resolve_module(pkg, from);
            mod.imports.push({alias: alias, from: import_mod});
            mod.aliases[alias] = import_mod;
        }
        mod.location = location;
        mod.context = context;
        mod.self_ref = self_ref;
        return mod
    }

    /**
     * Takes the current Package and a `(module ...)` form, and returns a Module
     * object. The module is added to the registry as part of the
     * current_package, and any imports aliases are added (but not loaded!).
     */
    parse_module_form(current_package, module_form) {
        const mod_opts = Module.parse_opts(current_package.name, module_form);
        const module = this.ensure_module(current_package.name, mod_opts.get('name'));
        module.merge_opts(mod_opts.assoc('imports', mod_opts.get('imports').map(({alias, from})=>{
            if (typeof from === 'string') {
                return {js_module: true,
                        module_path: from,
                        alias: alias,
                        from: this.resolve_module(current_package.name, from)}
            }
            return {alias: alias, from: this.resolve_module(current_package.name, from)}
        })));
        return module
    }

    /**
     * Helper method to extract the package+mod names, either from a given
     * PrefixName (1-arg), from a single String arg (gets split by colon
     * separator), or from explicitly given String args for pkg and mod (2-args)
     */
    split_mod_name(pkg, mod) {
        if (!mod) {
            if (typeof pkg === 'string' && pkg.includes('://')) {
                pkg = QSym.parse(pkg);
            }
            if (pkg instanceof PrefixName) {
                throw "PrefixName used where package name (Sym or QSym) was expected"
            } else if (pkg instanceof Sym) {
                // When identifying a package with a symbol the two components
                // (pkg/mod) are assigned to the mod/var fields. This is an
                // implementation detail that really only occurs in module forms.
                mod = pkg.name;
                pkg = pkg.mod;
            } else if (pkg instanceof QSym) {
                mod = pkg.mod;
                pkg = pkg.pkg;
            } else if (pkg instanceof String) {
                const parts = pkg.split(":");
                switch (parts.length) {
                case 1:
                    mod = parts[0];
                    pkg = this.current_module.deref().pkg;
                    break
                case 2:
                    pkg = parts[0] || this.current_module.deref().pkg;
                    mod = parts[1];
                    break
                }
            }

        }
        assert_type(pkg, 'string');
        assert_type(mod, 'string');
        return [pkg, mod]
    }

    inspect() {
        let s = "\nModuleRegistry(\n";
        for (const [pkg_name, pkg] of Object.entries(this.packages)) {
            for (const [mod_name, mod] of Object.entries(pkg.modules)) {
                s += `${pkg_name}:${mod_name}=${mod.inspect()},\n`;
            }
        }
        s+=")";
        return s
    }
}

// Copyright (c) Arne Brasseur 2023. All rights reserved.

/**
 * Special marker property to signal that an object/value is part of the Piglet
 * world. Any builtins (collections, identifiers), as well as types created
 * within user code (except when using the most low level constructs), get
 * marked as a "piglet object".
 *
 * This acts as a allowlist/denylist of sorts, in that we never treat these
 * objects as raw JS objects. This in turn allows us to have more convenient JS
 * interop, since we don't risk accidentally exposing a Piglet value as a plain
 * JS value.
 */

const PIGOBJ_SYM = Symbol("piglet:lang:piglet-object");

function mark_as_piglet_object(o, v) {
    Object.defineProperty(o, PIGOBJ_SYM, {value: true, writable: false});
    return o
}

function piglet_object_p(o) {
    const t = typeof o;
    return ("undefined" !== t || "null" !== t) && o[PIGOBJ_SYM]
}

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const Conjable = new Protocol(
    null,
    "piglet:lang",
    "Conjable",
    [["-conj", [[["this", "e"], "Return a collection with the element added"]]]]
);

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const Counted = new Protocol(
    null,
    "piglet:lang",
    "Counted",
    [["-count", [[["this"], "The number of elements in the collection"]]]]
);

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const Derefable = new Protocol(
    null,
    "piglet:lang",
    "Derefable",
    [["deref", [[["this"], "Derefence a reference type"]]]]
);

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const DictLike = new Protocol(
    null,
    "piglet:lang",
    "DictLike",
    [["-keys", [[["this"], "Get a sequence of all keys in the dict"]]],
     ["-vals", [[["this"], "Get a sequence of all values in the dict"]]]]
);

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const MutableAssociative = new Protocol(
    null,
    "piglet:lang",
    "MutableAssociative",
    [["-assoc!", [[["this", "k", "v"], "Associate the given value with the given key"]]],
     ["-dissoc!", [[["this", "k"], "Remove the association between the the given key and value"]]]]);

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const MutableCollection = new Protocol(
    null,
    "piglet:lang",
    "MutableCollection",
    [["-conj!", [[["coll", "el"], "Add element to collection, mutates the collection, returns the collection."]]]]
);

// Copyright (c) Arne Brasseur 2023. All rights reserved.


// Used for things that either "are" (QName, QSym), or "Have" (Var) a fully qualified name
const QualifiedName = new Protocol(
    null,
    "piglet:lang",
    "QualifiedName",
    [["-fqn", [[["this"], "Fully qualifed name, should return an absolute URI as a string, or nil."]]]]
);

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const Sequential = new Protocol(
    null,
    "piglet:lang",
    "Sequential",
    []
);

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const Swappable = new Protocol(
    null,
    "piglet:lang",
    "Swappable",
    [["-swap!", [[["this", "fn", "args"], "Swap the value contained in reference type by applying a function to it."]]]]
);

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const TaggedValue = new Protocol(
    null,
    "piglet:lang",
    "TaggedValue",
    [["-tag", [[["this"], ""]]],
     ["-tag-value", [[["this"], ""]]]]
);

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const Walkable = new Protocol(
    null,
    "piglet:lang",
    "Walkable",
    [["-walk", [[["this", "f"],
                 "Apply the given function to each element in the collection, returning a collection of the same type and size"]]]]
);

// Copyright (c) Arne Brasseur 2023. All rights reserved.

const module_registry = ModuleRegistry.instance();

const pkg_piglet = module_registry.ensure_package(PIGLET_PKG);
const self = module_registry.ensure_module(PIGLET_PKG, "lang");

self.intern('module-registry', module_registry);
self.intern('*current-module*', self);
self.intern('*current-package*', pkg_piglet);
self.intern('*current-context*', self.context);
self.intern('*current-location*', import.meta.url);
self.intern('*verbosity*', 0)

// Intern classes
;[
    AbstractIdentifier, AbstractSeq, Cons, Context, Dict, IteratorSeq, Keyword,
    LazySeq, List, Module, Package, PrefixName, Protocol, QName, QSym, Range,
    Repeat, SeqIterator, Sym, Var, HashSet
].forEach(klz => { self.intern(klz.name, klz); mark_as_piglet_object(klz.prototype); })

// Interns protocols and their methods
;[
    Associative, Conjable, Counted, Derefable, DictLike, Eq, Empty, Hashable,
    Lookup, MutableAssociative, MutableCollection, Named, Repr, Seq, Seqable,
    Sequential, Swappable, TaggedValue, Walkable, WithMeta, QualifiedName
].forEach(proto => { proto.intern(self); mark_as_piglet_object(proto); });

const deref = Derefable.deref;

self.intern("*seq-print-limit*", 100);
self.intern("*qname-print-style*", keyword("compact"));
self.intern("*compiler*", null);
const print_depth = self.intern("*print-depth*", 0);
const print_max_depth = self.intern("*print-max-depth*", 12);
const print_stack = self.intern("*print-stack*", set());
const data_readers = self.intern("*data-readers*", Dict.of(null));

self.intern("meta", meta);
self.intern("set-meta!", set_meta);
self.intern("reset-meta!", reset_meta);
self.intern("mark-as-piglet-object", mark_as_piglet_object);
self.intern("piglet-object?", piglet_object_p);
self.intern("assert", assert);
self.intern("hash", hash_code);
self.intern("hash-bytes", hash_bytes);
self.intern("hash-str", hash_str);
self.intern("hash-combine", hash_combine);
self.intern("hash-num", hash_num);

self.intern("list-ctor", function(meta, ...args) {return new List(Array.from(args))});
self.intern("set-ctor", function(meta, ...args) {return HashSet.of(meta, ...args)});
self.intern("dict-ctor", function(meta, ...args) {return Dict.of(meta, ...args)});

const kw_async = keyword("async");
const kw_compact = keyword('compact');

function list(...args) { return self.resolve("list-ctor")(null, ...args) }
self.intern("list", list);

function list_STAR(...args) { return list(...butlast(args), ...last(args)) }
self.intern("list*", list_STAR);

function range(...args) {
    switch (args.length) {
    case 0: return Range.range0(...args);
    case 1: return Range.range1(...args);
    case 2: return Range.range2(...args);
    case 3: return Range.range3(...args);
    }
}
self.intern("range", range);

function symbol_p(s) {
    return s instanceof Sym
}
self.intern("symbol?", symbol_p);

function js_symbol_p(s) {
    return typeof s === 'symbol'
}
self.intern("js-symbol?", symbol_p);
self.intern("keyword", keyword);
self.intern("symbol", symbol);
self.intern("set", set);

function keyword_p(o) {return o instanceof Keyword}
self.intern("keyword?", keyword_p);

function qname(name, separator, suffix) {
    if (name instanceof PrefixName && separator === undefined && suffix === undefined) {
        return Context.expand(deref(resolve(symbol("*current-context*"))), name)
    }
    return new QName(null, name, separator, suffix)
}
self.intern("qname", qname);

function qsym(name) {return new QSym(null, name)}
self.intern("qsym", qsym);

function prefix_name(prefix, suffix) {
    if (suffix === undefined) {
        return PrefixName.parse(prefix)
    }
    return new PrefixName(null, prefix, suffix)
}
self.intern("prefix-name", prefix_name);

function prefix_name_p(o) {return o instanceof PrefixName}
self.intern("prefix-name?", prefix_name_p);

function qname_p(o) {return o instanceof QName}
self.intern("qname?", qname_p);

function qsym_p(o) {return o instanceof QSym}
self.intern("qsym?", qsym_p);

function expand_qnames(o) {
    const postwalk = resolve(symbol('piglet:lang:postwalk'));
    const current_context = resolve(symbol('piglet:lang:*current-context*'));
    return postwalk((v)=>(v instanceof PrefixName ? Context.expand(deref(current_context), v) : v), o)
}
self.intern("expand-qnames", expand_qnames);

function name(o) {
    if (o == null) return null
    if (typeof o === 'string') {
        return o
    }
    if (Named.satisfied(o)) {
        return Named._name(o)
    }
    return `${o}`
}
self.intern("name", name);

function mod_name(sym) {
    return sym.mod
}
self.intern("mod-name", mod_name);

function pkg_name(sym) {
    return sym.pkg
}
self.intern("pkg-name", pkg_name);

function type(o) {
    const t = typeof o;
    if (o && (t === "object" || t === "function") && o.constructor)
        return o.constructor
    return t
}
self.intern("type", type);

function fqn(o) {
    return QualifiedName._fqn(o)
}
self.intern("fqn", fqn);

function find_package(pkg) {
    if (pkg instanceof QSym) {
        return module_registry.find_package(fqn(pkg))
    }
    if (pkg instanceof String) {
        if (pkg.includes("://")) {
            return module_registry.find_package(pkg)
        }
        const fqn = deref(self.resolve("*current-package*")).resolve_alias(pkg);
        if (fqn) {
            return module_registry.find_package(fqn)
        }
    }
    if (pkg instanceof Sym) {
        const fqn = deref(self.resolve("*current-package*")).resolve_alias(name(pkg));
        if (fqn) {
            return module_registry.find_package(fqn)
        }
    }
    return null
}
self.intern("find-package", find_package);

function find_module(pkg, mod) {
    if (mod === undefined) { // called with one argument
        if (pkg instanceof Sym) {
            const mod_name = pkg.name;
            pkg.mod;
            const resolved_alias = deref(self.resolve("*current-module*")).resolve_alias(mod_name);
            if (resolved_alias) return resolved_alias
            return find_module(
                pkg.mod || deref(self.resolve("*current-package*")).name,
                pkg.name)
        }
        if (pkg instanceof QSym) {
            return find_module(pkg.pkg, pkg.mod)
        }
        throw new Error("Unexpected argument to find_module", inspect(pkg), inspect(mod))
    }
    assert_type(pkg, 'string');
    assert(mod === null || typeof mod === 'string');
    if (pkg.includes("://")) {
        return module_registry.find_module(pkg, mod)
    } else {
        pkg = self.resolve("*current-package*").deref().resolve_alias(pkg);
    }
    return module_registry.find_module(pkg, mod)
}
self.intern("find-module", find_module);

function ensure_module(pkg, mod) {
    if (!mod && pkg instanceof PrefixName) {
        throw `PrefixName used for module identifier, use sym/qsym`
    }
    if (!pkg.includes("://")) {
        pkg = self.resolve("*current-package*").deref().resolve_alias(pkg);
    }
    return module_registry.ensure_module(pkg, mod)
}
self.intern("ensure-module", ensure_module);

function resolve(sym) {
    let module = self.resolve("*current-module*").deref();
    if (sym instanceof QSym) {
        return find_module(sym.pkg, sym.mod)?.resolve(sym.name)
    }
    if (sym instanceof Sym) {
        if (sym.pkg) {
            module = find_module(sym.pkg, sym.mod);
        } else {
            if(sym.mod) {
                if (module.resolve_alias(sym.mod)) {
                    module = module.resolve_alias(sym.mod);
                    assert(module instanceof Module);
                } else {
                    module = find_module(module.pkg, sym.mod);
                }
            }
        }
        return module?.resolve(sym.name)
    }
    throw new Error(`resolve takes a Sym or QSym, got ${inspect(sym)} ${typeof sym}`)
}
self.intern("resolve", resolve);

function inspect(value) {
    if (value?.inspect) {
        return value.inspect()
    }
    if (value === null) {
        return "nil"
    }
    return print_str(value)
}
self.intern("inspect", inspect);

function intern(sym, val, meta) {
    let mod = self.resolve("*current-module*").deref();
    return ensure_module(sym.pkg || mod.pkg, sym.mod || mod.name).intern(sym.name, val, meta)
}
self.intern("intern", intern);

function conj(coll, o, ...rest) {
    if (rest.length > 0) {
        return [...rest].reduce((acc,e)=>conj(acc,e), conj(coll,o))
    }
    // Allow collection-specific
    if (Conjable.satisfied(coll)) {
        return Conjable._conj(coll, o)
    }
    // Seq-like things don't necessarily need to implement -conj, we default to cons
    if (seq_p(coll) || seqable_p(o)) {
        return cons(o, coll)
    }
    // Throws "protocol not implemented"
    return Conjable._conj(coll, o)
}
self.intern("conj", conj);

function conj_BANG(coll, o, ...rest) {
    if (rest.length > 0) {
        return [...rest].reduce((acc,e)=>conj_BANG(acc,e), conj_BANG(coll,o))
    }
    return MutableCollection._conj_$BANG$_(coll, o)
}
self.intern("conj!", conj_BANG);

function cons(val, s) {
    return new Cons(val, Seq.satisfied(s) ? s : seq(s))
}
self.intern("cons", cons);

function satisfies_p(protocol, obj) {
    return protocol.satisfied(obj)
}
self.intern("satisfies?", satisfies_p);
self.intern("munge", munge);
self.intern("unmunge", unmunge);
self.intern("partition", partition_n_step);
self.intern("partition-all", partition_all_n_step);

function object_p(o) {
    return o != null && !Array.isArray(o) && !piglet_object_p(o) && "object" === typeof o
}
self.intern("object?", object_p);

function fn_p(o) {
    return typeof o === 'function' && !piglet_object_p(o)
}
self.intern("fn?", fn_p);

function array_p(o) {
    return Array.isArray(o)
}
self.intern("array?", array_p);

function iterator_p(o) {
    return o && fn_p(o.next)
}
self.intern("iterator?", iterator_p);

function iterable_p(o) {
    return !!o?.[Symbol.iterator]
}
self.intern("iterable?", iterable_p);

function iterator(o) {
    if (iterator_p(o)) {
        return o
    }
    if (iterable_p(o)) {
        return o[Symbol.iterator]()
    }
    if (seq_p(o)) {
        return new SeqIterator(o)
    }
    if (seqable_p(o)) {
        return new SeqIterator(seq(o))
    }
}
self.intern("iterator", iterator);

function seq_p(o) {
    return o != null && Seq.satisfied(o)
}
self.intern("seq?", seq_p);

function nil_p(o) {
    return o == null
}
self.intern("nil?", nil_p);

function seqable_p(o) {
    return Seqable.satisfied(o)
}
self.intern("seqable?", seqable_p);

function sequential_p(o) {
    return Sequential.satisfied(o)
}
self.intern("sequential?", sequential_p);

function dict(...kvs) {
    return self.resolve("dict-ctor")(null, ...kvs)
}
self.intern("dict", dict);

function dict_p(o) {
    return DictLike.satisfied(o)
}
self.intern("dict?", dict_p);

function vector_p(o) {
    return Array.isArray(o) // :P no real vectors yet
}
self.intern("vector?", vector_p);

function set_p(o) {
    return o instanceof HashSet
}
self.intern("set?", set_p);

function seq(o) {
    if (null === o || undefined === o) {
        return null
    }
    if (Empty.satisfied(o) && Empty._empty_$QMARK$_(o)) {
        return null
    }
    if (Seq.satisfied(o)) {
        return o
    }
    if (iterator_p(o)) {
        return IteratorSeq.of(o)
    }
    if (iterable_p(o)) {
        return IteratorSeq.of(iterator(o))
    }
    if (seqable_p(o)) {
        return Seqable._seq(o)
    }
    throw new Error("" + o + " is not seqable")
}
self.intern("seq", seq);

function first(o) {
    return Seq._first(seq(o))
}
self.intern("first", first);

function second(o) {
    return first(rest(o))
}
self.intern("second", second);

function third(o) {
    return first(rest(rest(o)))
}
self.intern("third", third);

function fourth(o) {
    return first(rest(rest(rest(o))))
}
self.intern("fourth", fourth);

function nth(o, n) {
    if (n < 0) {
        return nth(reverse(o), -n-1)
    }
    while (n > 0) {
        o = rest(o);
        n--;
    }
    return first(o)
}
self.intern("nth", nth);

function rest(o) {
    if (Seq.satisfied(o)) {
        return Seq._rest(o)
    } else {
        return Seq._rest(seq(o))
    }
}
self.intern("rest", rest);

function make_lazy_seq(thunk) {
    return new LazySeq(thunk)
}
self.intern("make-lazy-seq", make_lazy_seq);

function seq_str(s) {
    let remaining = deref(self.resolve("*seq-print-limit*"));
    if (!seq(s)) {
        return "()"
    }
    let res = "(" + print_str(first(s));
    remaining--;
    s = rest(s);
    while (s) {
        if (remaining === 0) {
            return res + " ...)"
        }
        res += " " + print_str(first(s));
        s = rest(s);
        remaining--;
    }
    return res + ")"
}

function array_str(a) {
    const limit = deref(self.resolve("*seq-print-limit*"));
    if (a.length > limit) {
        return `[${Array.from(a.slice(0, limit), (o)=>print_str(o)).join(", ")}, ...]`
    }
    return `[${Array.from(a, (x)=>print_str(x)).join(", ")}]`
}
self.intern("array-str", array_str);

function object_string_tag(o) {
    return o[Symbol.toStringTag]
}
self.intern("object-string-tag", object_string_tag);

function _print_safe_object_lookup(o, k) {
    try {
        return o[k]
    } catch(_) {
        return "...print-error..."
    }
}

function print_str(o, ...args) {
    if (args.length > 0) {
        return `${print_str(o)} ${print_str(...args)}`
    }
    try {
        if (print_depth.value > print_max_depth.value) {
            return "...*print-max-depth* exceeded..."
        }
        if (print_stack.value.has(o)) {
            return "...circular..."
        }
        print_depth.push_binding(print_depth.value + 1);
        if (o === undefined) return "undefined"
        try {
            print_stack.push_binding(print_stack.value.conj(o));
            if (Repr.satisfied(o)) return Repr._repr(o)
            if (TaggedValue.satisfied(o)) return `#${TaggedValue._tag(o)} ${print_str(TaggedValue._tag_value(o))}`
            if (typeof o === 'object') {
                let s = "";
                if (meta(o)) {
                    s+=`^${print_str(meta(o))} `;
                }
                if(seq_p(o)) return s + seq_str(o)

                if (o.toString && o.toString !== {}.toString) return s+o.toString()

                if (o?.constructor) {
                    const tag_name = (o[Symbol.toStringTag] || o.constructor?.name);
                    if (typeof o.toJSON === 'function') {o = o.toJSON() || o;}
                    if (tag_name !== "Object") {
                        return s + "#js:" + tag_name + " {" +Object.keys(o).map(k=>":"+k+" "+print_str(_print_safe_object_lookup(o,k))).join(", ") + "}"
                    }
                }
                if (typeof o.toJSON === 'function') {o = o.toJSON();}
                return s + "#js {" + Object.keys(o).map(k=>":"+k+" "+print_str(_print_safe_object_lookup(o,k))).join(", ") + "}"
            }
        } finally {
            print_stack.pop_binding();
        }
        return `${o}`
    } finally {
        print_depth.pop_binding();
    }
}
self.intern("print-str", print_str);

function println(...args) {
    console.log(...Array.from(args, (a)=>(typeof a === 'string') ? a : print_str(a)));
    return null
}
self.intern("println", println);

function prn(...args) {
    console.log(...Array.from(args, (a)=>print_str(a)));
    return null
}
self.intern("prn", prn);

class Reduced {
    constructor(value) {
        this.value = value;
    }
}
self.intern("Reduced", Reduced);

function reduced(value) {
    return new Reduced(value)
}
self.intern("reduced", reduced);

function reduced_p(o) {
    return o instanceof Reduced
}
self.intern("reduced?", reduced_p);

function reduce(rf, ...args) {
    let coll, acc;
    const async_p = get(meta(rf), kw_async);
    if (args.length == 2) {
        acc = args[0];
        coll = args[1];
    } else {
        coll = args[0];
        acc = first(coll);
        coll = rest(coll);
    }
    if (async_p) {
        function next(acc) {
            acc = rf(acc, first(coll));
            coll = rest(coll);
            return acc
        }
        if (seq(coll)) acc = next(acc);
        acc = acc.then((acc)=>{
            if (reduced_p(acc)) return acc.value
            if (seq(coll)) return next(acc)
            return acc
        });
    } else {
        if (iterable_p(coll)) {
            for (const val of coll) {
                acc = rf(acc, val);
                if (reduced_p(acc)) return acc.value
            }
            return acc
        }
        while (seq(coll)) {
            acc = rf(acc, first(coll));
            if (reduced_p(acc)) return acc.value
            coll = rest(coll);
        }
    }
    return acc
}
self.intern("reduce", reduce);

function map(f, ...colls) {
    // convert iterators to seq once, so we don't try to
    // consume them multiple times
    colls = colls.map(seq);
    const res = [];
    let args = [];
    while (colls.every((c)=>c)) {
        if (res.length === 64) {
            const concat = self.resolve("concat");
            if (concat) {
                return concat(
                    res,
                    make_lazy_seq(()=>map(f, ...colls))
                )
            }
        }
        args = colls.map(first);
        colls = colls.map(rest);
        res.push(f(...args));
    }
    return list(...res)
}
self.intern("map", map);

function filter(pred, coll) {
    const res = [];
    let el = [];
    while (seq(coll)) {
        el = first(coll);
        coll = rest(coll);
        if (pred(el)) {
            res.push(el);
        }
    }
    return list(...res)
}
self.intern("filter", filter);

function remove(pred, coll) {
    return filter(complement(pred), coll)
}
self.intern("remove", remove);

function reverse(coll) {
    return reduce((acc,e)=>cons(e,acc), null, coll)
}
self.intern("reverse", reverse);

function complement(pred) {
    return (el)=>!pred(el)
}
self.intern("complement", complement);

function plus(a,b) {
    switch(arguments.length) {
    case(0):
        return 0
    case(1):
        return a
    case(2):
        return a + b
    default:
        const acc = 0;
        for (const arg of arguments) acc += arg;
        return acc
    }
}
self.intern("+", plus);

function minus(a, b) {
    switch(arguments.length) {
    case(0):
        return 0
    case(1):
        return -a
    case(2):
        return a - b
    default:
        const acc = a;
        for (const arg of Array.prototype.slice.call(arguments, 1)) acc -= arg;
        return acc
    }
}
self.intern("-", minus);

function multiply(a, b) {
    switch(arguments.length) {
    case(0):
        return 1
    case(1):
        return a
    case(2):
        return a * b
    default:
        const acc = a;
        for (const arg of arguments) acc *= arg;
        return acc
    }
}
self.intern("*", multiply);

function divide(a, b) {
    switch(arguments.length) {
    case(0):
        return 1
    case(1):
        return a
    case(2):
        return a / b
    default:
        const acc = a;
        for (const arg of Array.prototype.slice.call(arguments, 1)) acc /= arg;
        return acc
    }
}
self.intern("/", divide);

function string_reader(source, filename) {
    return new StringReader(source, filename, data_readers.value.toJSON())
}
self.intern("string-reader", string_reader);

function read_string(s) {
    return string_reader(s).read()
}
self.intern("read-string", read_string);

function str(...args) {
    return args.map((a)=>nil_p(a) ? "" : string_p(a) ? a : print_str(a)).join("")
}
self.intern("str", str);

function string_p(o) {
    return typeof o === 'string'
}
self.intern("string?", string_p);

function assoc(m, k, v, ...args) {
    if (args.length > 0) {
        return apply(assoc, assoc(m, k, v), args)
    }
    const res = Associative._assoc(m, k, v);
    return (meta(m) && WithMeta.satisfied(res)) ? with_meta(res, meta(m)) : res
}
self.intern("assoc", assoc);

function assoc_$BANG$_(m, k, v, ...args) {
    if (args.length > 0) {
        return apply(assoc_$BANG$_, assoc_$BANG$_(m, k, v), args)
    }
    const res = MutableAssociative._assoc_$BANG$_(m, k, v);
    return res
}
self.intern("assoc!", assoc_$BANG$_);

function dissoc(m, k, ...args) {
    if (args.length > 0) {
        return apply(dissoc, dissoc(m,k), args)
    }
    const res = Associative._dissoc(m, k);
    return (meta(m) && WithMeta.satisfied(res)) ? with_meta(res, meta(m)) : res
}
self.intern("dissoc", dissoc);

function dissoc_$BANG$_(m, k) {
    return MutableAssociative._dissoc_$BANG$_(m, k)
}
self.intern("dissoc!", dissoc_$BANG$_);

function get(m, k, fallback) {
    if (Lookup.satisfied(m)) {
        if (fallback === undefined) {
            return Lookup._get(m, k)
        }
        return Lookup._get(m, k, fallback)
    }
    const prop = js_symbol_p(k) ? k : name(k);
    if (fallback === undefined) {
        return m[prop]
    }
    return prop in m ? m[prop] : fallback
}
self.intern("get", get);

function keys(m) {
    if (DictLike.satisfied(m)) {
        return DictLike._keys(m)
    }
    return Object.keys(m)
}
self.intern("keys", keys);

function vals(m) {
    if (DictLike.satisfied(m)) {
        return DictLike._vals(m)
    }
    return Object.values(m)
}
self.intern("vals", vals);

function alter_meta(o, f, ...args) {
    const new_meta = f(meta(o), ...args);
    reset_meta(o, new_meta);
    return new_meta
}
self.intern("alter-meta!", alter_meta);

function count(coll) {
    if (coll == null) {
        return 0
    }
    if (Counted.satisfied(coll)) {
        return Counted._count(coll)
    }
    if (iterable_p(coll)) {
        let acc = 0;
        for (const _ of coll) acc+=1;
        return acc
    }
    const s = seq(coll);
    if (s) {
        return reduce((acc,_)=>acc+1, 0, s)
    }
    throw new Error("Unable to count ${coll && coll?.inpect ? coll.inspect() : coll}")
}
self.intern("count", count);

function seq_eq(self, other) {
    if (self === other) return true
    if (!sequential_p(other)) return false
    if (Counted.satisfied(self) && Counted.satisfied(other)) {
        if (Counted._count(self) !== Counted._count(other)) return false
        if (Counted._count(self) === 0) return true
    }
    let xa = first(self);
    let xb = first(other);
    if (!eq(xa, xb)) return false
    while (self && other) {
        self = rest(self);
        other = rest(other);
        xa = first(self);
        xb = first(other);
        if (!eq(xa, xb)) return false
    }
    if (null === self && null === other) return true
    return false
}

function eq2(a, b) {
    if (a === b) return true
    if (hash_code(a) !== hash_code(b)) return false
    if (Eq.satisfied(a)) return Eq._eq(a, b)

    if (sequential_p(a)) {
        if (!sequential_p(b)) return false
        const ca = count(a);
        const cb = count(b);
        if (ca !== cb) return false
        if (ca === 0) return true
        if (iterable_p(a) && iterable_p(b)) {
            const ia = iterator(a);
            const ib = iterator(b);
            while (true) {
                let va = ia.next();
                let vb = ib.next();
                if (va.done !== vb.done) return false
                if (va.done) return true
                if (eq2(va.value, vb.value)) {
                    va = ia.next();
                    vb = ib.next();
                }
            }
        }
        return seq_eq(a, b)
    }

    if (dict_p(a)) {
        if (!dict_p(b)) return false
        if (count(a) !== count(b)) return false
        if (count(a) === 0) return true
        for (const k of keys(a)) {
            if (!eq2(get(a, k), get(b, k))) return false
        }
        return true
    }

    // We do recurse into the prototype, and we do consider full piglet value
    // equality for object values. We don't consider Symbol properties.
    if (object_p(a)) {
        if (!object_p(b)) return false
        if (!eq2(Object.getPrototypeOf(a), Object.getPrototypeOf(b))) return false
        if (Object.keys(a).length !== Object.keys(b).length) return false
        for (const k of Object.getOwnPropertyNames(a)) if (!eq2(a[k], b[k])) return false
        return true
    }

    return false
}

function eq(a, b) {
    switch(arguments.length) {
    case(0):
    case(1): return true
    case(2): return eq2(a,b)
    default:
        if (eq2(a,b)) {
            for (const o of Array.prototype.slice.call(arguments, 2))
                if (!eq2(a,o)) return false
            return true
        }
        return false
    }
}
self.intern("=", eq, dict(keyword("tag"), symbol("boolean")));

function truthy_p(v) {
    return v !== false && v !== null && v !== undefined
}
self.intern("truthy?", truthy_p, dict(keyword("tag"), symbol("boolean")));

function falsy_p(v) {
    return v === false || v === null || v === undefined
}
self.intern("falsy?", falsy_p, dict(keyword("tag"), symbol("boolean")));

function and(... args) {
    let ret = null;
    for(let a of args) {
        if (falsy_p(a)) return false
        ret = a;
    }
    return ret
}
self.intern("and", and);

function or(... args) {
    for(let a of args) {
        if (truthy_p(a)) return a
    }
    return args.slice(-1)[0]
}
self.intern("or", or);

function not(v) {
    return falsy_p(v) ? true : false
}
self.intern("not", not);
self.intern("gensym", gensym);

function require(mod) {
    if (symbol_p(mod)) { // resolve sym to qsym
        if (mod.mod) {
            mod = qsym(`${deref(self.resolve("*current-package*")).resolve_alias(mod.mod)}:${mod.name}`);

        } else {
            mod = qsym(`${deref(self.resolve("*current-package*")).name}:${mod}`);
        }
    }
    return self.resolve("*compiler*").deref().require(mod)
}
self.intern("require", require);

async function js_import(mod_path) {
    const mod = module_registry.resolve_module(deref(self.resolve("*current-package*")).name, mod_path);
    if (mod.required) {
        return mod
    }
    const compiler = deref(resolve(symbol("piglet:lang:*compiler*")));
    let path;
    if (compiler) {
        path=compiler.resolve_js_path(mod_path);
        if (!path) {
            throw new Error(`Could not find JS module ${mod_path} in ${fqn(deref(resolve(symbol("*current-module*"))))}`)
        }
    } else {
        path=mod_path;
    }
    // import(.., {assert: {type: "json"}}) is non-standard, not supported in
    // Firefox and Operai
    // const imported = await (path.endsWith(".json") ?
    // import(/* @vite-ignore */ path, {assert: {type: "json"}}) :
    // import(/* @vite-ignore */ path))
    const imported = await (import(/* @vite-ignore */ path));
    for(const [k, v] of Object.entries(imported)) {
        mod.intern(unmunge(k), v);
    }
    mod.is_js_import = true;
    mod.required = true;
    return mod
}
self.intern("js-import", js_import);

self.intern("eval", async function(form) {
    if (!self.resolve("*compiler*").deref()) {
        throw new Error("No compiler present, can't eval.")
    }
    return await self.resolve("*compiler*").deref().eval(form)
});

function apply(fn, ...args) {
    return fn.apply(null, args.slice(0,-1).concat(Array.from(seq(args.slice(-1)[0]) || [])))
}
self.intern("apply", apply);

function butlast(arg) {
    if (nil_p(arg)) return list()
    return Array.from(arg).slice(0, -1)
}
self.intern("butlast", butlast);

function last(arg) {
    if (nil_p(arg)) return null
    const arr = Array.from(arg);
    if (arr.length === 0) return null
    return arr.slice(-1)[0]
}
self.intern("last", last);

function with_meta(o, m) {
    // println(with_meta(o, m))
    if (eq(m, meta(o))) {
        return o
    }
    if (WithMeta.satisfied(o)) {
        // println("satisfied!")
        return WithMeta._with_meta(o, m)
    }
    throw new Error(`Object ${print_str(o)} ${o?.constructor?.name} does not implement WithMeta`)
}
self.intern("with-meta", with_meta);

function vary_meta(o, f, ...args) {
    return with_meta(o, apply(f, meta(o), args))
}
self.intern("vary-meta", vary_meta);

function swap_$BANG$_(o, f, ...args) {
    return Swappable._swap_$BANG$_(o, f, args)
}
self.intern("swap!", swap_$BANG$_);

function postwalk(f, i) {
    let o = f(Walkable.satisfied(i) ? Walkable._walk(i, (v)=>postwalk(f, v)) : i);
    if (meta(i)) {
        if (WithMeta.satisfied(o))
            o = with_meta(o, meta(i));
        else
            o = set_meta(o, meta(i));
    }
    if (Object.isFrozen(o)) Object.freeze(o);
    else if (Object.isSealed(o)) Object.seal(o);
    return o
}
self.intern("postwalk", postwalk);

function prewalk(f, i) {
    let o = f(i);
    o = (Walkable.satisfied(o) ? Walkable._walk(o, (v)=>prewalk(f, v)) : o);
    if (meta(i)) {
        if (WithMeta.satisfied(o))
            o = with_meta(o, meta(i));
        else
            o = set_meta(o, meta(i));
    }
    if (Object.isFrozen(o)) Object.freeze(o);
    else if (Object.isSealed(o)) Object.seal(o);
    return o
}
self.intern("prewalk", prewalk);

function select_keys(d, keyseq) {
    if (d == null) return null
    const kvs = [];
    for (const k of keyseq) {
        if (d.has(k)) {
            kvs.push(k);
            kvs.push(get(d, k));
        }
    }
    return apply(dict, kvs)
}
self.intern("select-keys", select_keys);

////////////////////////////////////////////////////////////////////////////////

Associative.extend(
    null,
    [function _assoc(_, k, v) { return dict(k, v) },
     function _dissoc(_, k) { return null }],

    Object,
    [function _assoc(o, k, v) { return MutableAssociative._assoc_$BANG$_(Object.assign({}, o), k, v) },
     function _dissoc(o, k)  { return MutableAssociative._dissoc_$BANG$_(Object.assign({}, o), k) }],

    Map,
    [function _assoc(map, k, v) {map = new Map(map); map.set(k, v); return map},
     function _dissoc(map, k) {map = new Map(map); map.delete(k); return map}],

    Set,
    [function _assoc(set, k, v) {
        if (eq(k,v)) {
            set = new Set(set);
            set.add(k);
            return set
        } else throw new Error(`In order to assoc onto a Set, key and value must be equal, got ${print_str(k)}, ${print_str(v)}`)
    },
     function _dissoc(set, k) {set = new Set(set); set.delete(k); return set}],

    Array,
    [function _assoc(arr, idx, v) { return arr.map((el, i)=>i===idx?v:el)}],

    Dict,
    [function _assoc(dict, k, v) { return dict.assoc(k, v)},
     function _dissoc(dict, k) { return dict.dissoc(k)}],

    HashSet,
    [function _assoc(set, k, v) {
        if (eq(k,v)) {
            return set.conj(k)
        } else throw new Error(`In order to assoc onto a Set, key and value must be equal, got ${print_str(k)}, ${print_str(v)}`)
    },
     function _dissoc(set, k) { return set.disj(k)}],
);

Conjable.extend(
    null,
    [function _conj(coll, el) { return cons(el, null)}],

    Object,
    [function _conj(coll, el) { return conj_BANG(Object.assign({}, coll), el)}],

    Array,
    [function _conj(coll, el) { const copy = [...coll]; copy.push(el) ; return copy }],

    Map,
    [function _conj(coll, el) { coll = new Map(coll); coll.set(first(el), first(rest(el))); return coll}],

    Cons,
    [function _conj(coll, el) { return cons(el, coll)}],

    List,
    [function _conj(coll, el) { return coll.conj(el)}],

    Dict,
    [function _conj(coll, kv) { return assoc(coll, first(kv), first(rest(kv)))}],

    HashSet,
    [function _conj(coll, o) { return coll.conj(o)}],

    Context,
    [function _conj(coll, kv) { return assoc(coll, first(kv), first(rest(kv)))}],

    Range,
    [function _conj(coll, el) { return cons(el, coll)}],

    Repeat,
    [function _conj(coll, el) { return cons(el, coll)}],
);

Counted.extend(
    Array, [function _count(coll) { return coll.length }],
    Map, [function _count(coll) { return coll.size }],
    Set, [function _count(coll) { return coll.size }],
    List, [function _count(coll) { return coll.count() }],
    Dict, [function _count(coll) { return coll.count() }],
    HashSet, [function _count(coll) { return coll.count() }],
    Repeat, [function _count(coll) { return coll.count() }],
    Range, [function _count(coll) { return coll.count() }],
);

Derefable.extend(
    Var, [function deref(v) { return v.deref() }]
);

DictLike.extend(
    Map,
    [function _keys(m) {return IteratorSeq.of(m.keys())},
     function _vals(m) {return IteratorSeq.of(m.values())}],

    Dict,
    [function _keys(d) {return IteratorSeq.of(d.keys())},
     function _vals(d) {return IteratorSeq.of(d.values())}],

    // Set / HashSet ?

    Module,
    [function _keys(m) {return m.keys()},
     function _vals(m) {return m.values()}],
);

Empty.extend(
    null, [function _empty_$QMARK$_(_) { return true }],
    AbstractSeq, [function _empty_$QMARK$_(self) { return self.empty() }],
    Dict, [function _empty_$QMARK$_(self) { return self.count() === 0 }],
    Range, [function _empty_$QMARK$_(self) { return self.empty_p() }],
);

Eq.extend(
    null, [function _eq(self, other) { return null === other || undefined === other }],
    Number, [function _eq(self, other) { return self === other }],
    String, [function _eq(self, other) { return self === other }],
    Boolean, [function _eq(self, other) { return self === other }],

    Sym, [function _eq(self, other) { return self.eq(other) }],

    Range,
    [function _eq(self, other) {
        if (other instanceof Range && self.from === other.from && self.to === other.to && self.step == other.step) {
            return true
        }
        return seq_eq(self, other)
    }],

    Repeat,
    [function _eq(self, other) {
        if (other instanceof Repeat && self.count === other.count && self.value === other.value) {
            return true
        }
        return seq_eq(self, other)
    }],

    AbstractIdentifier,
    [function _eq(self, other) {
        return (other instanceof self.constructor && self.toString() == other.toString())
    }],

    HashSet,
    [function _eq(self, other) {
        return (other instanceof self.constructor &&
                self.count() === other.count() &&
                hash_code(self) === hash_code(other) &&
                reduce((acc,o)=>other.has(o) ? acc : reduced(false), true, self))
    }],

    ArrayBuffer,
    [function _eq(self, other) {
        if (other instanceof ArrayBuffer && self.byteLength === other.byteLength) {
            const s = new Int8Array(self);
            const o = new Int8Array(other);
            for (let i = 0 ; i < self.byteLength ; i++) {
                if (s[i] !== o[i]) return false
            }
            return true
        }
        return false
    }]
);

Hashable.extend(
    // builtins
    null, [(function _hash_code(_) { return 0 })],
    Boolean, [(function _hash_code(self) { return self ? 1231 : 1237 })],
    Number, [(function _hash_code(self) { return hash_num(self) })],
    BigInt, [(function _hash_code(self) { return hash_str(self.toString()) })],
    String, [(function _hash_code(self) { return hash_str(self) })],
    Symbol, [(()=>{
        let next_symbol_id = 1;
        return function _hash_code(o) {
            const sym_key = Symbol.keyFor(o);
            if (sym_key === undefined) {
                return next_symbol_id++
            }
            return hash_combine(hash_str(sym_key), 1)
        }
    })()],
    RegExp, [(function _hash_code(self) { return hash_str(`%r${self.toString()}`) })],
    Date, [(function _hash_code(self) { return self.valueOf() })],
    Array, [(function _hash_code(self) { return self.map((e)=>hash_code(e)).reduce(hash_combine, 0) })],
    Function, [(function _hash_code(self) { return hash_str(self.toString()) })],

    Object, [(()=>{
        let next_obj_id = 1;
        return function _hash_code(o) {
            if (Object.isFrozen(o)) {
                let hsh = hash_code(Object.getPrototypeOf(o));
                for (const p of Object.getOwnPropertyNames(o)) hsh = hash_combine(hsh, hash_combine(hash_str(p), hash_code(o[p])));
                return hsh
            }
            return next_obj_id++
        }
    })()],

    Object.getPrototypeOf(Int8Array),
    [(function _hash_code(self) { return self.map((e)=>hash_code(e)).reduce(hash_combine, 1) })],

    Set,
    [(function _hash_code(self) { return self.map((e)=>hash_code(e)).reduce(hash_combine, 2) })],

    // Piglet
    Sym, [(function _hash_code(self) {
        return hash_combine(
            self.pkg ? hash_str(self.pkg) : 0,
            hash_combine(self.mod ? hash_str(self.mod) : 0,
                         hash_str(self.name)))
    })],
    AbstractSeq, [(function _hash_code(self) { return Array.from(self, (e)=>hash_code(e)).reduce(hash_combine, 0) })],

    Dict,
    [(function _hash_code(self) {
        return Array.from(
            self, ([k,v]) => hash_combine(hash_code(k), hash_code(v))
        ).reduce(hash_combine, 4)})],

    HashSet, [(function _hash_code(self) {
        // We already have the hashes of any set elements in
        // self.entries.keys(), combine them as many times as there are elements
        // in the bucket. Sort them because the order in self.entries will
        // reflect insertion order, and so will differ for otherwise equivalent
        // sets, e.g. #{1 2} vs #{2 1}
        let acc = 5;
        for (const hsh of Array.from(self.entries.keys()).sort())
            for (let i = 0 ; i < self.entries.get(hsh).length; i++)
                acc = hash_combine(acc, hsh);
        return acc
    })],
    Keyword, [(function _hash_code(self) { return hash_str(self.inspect())})],

    ArrayBuffer,
    [(function _hash_code(self) {
        return hash_combine(hash_num(self.byteLength),
                            new Int8Array(self).reduce((acc, n)=>hash_combine(acc, hash_num(n)), 0))
    })]

);

Lookup.extend(
    null,
    [function _get(coll, k) { return null},
     function _get(coll, k, fallback) { return fallback}],

    Dict,
    [function _get(coll, k) { return coll.get(k)},
     function _get(coll, k, fallback) { return coll.get(k, fallback)}],

    Map,
    [function _get(coll, k) { return Lookup._get(coll, k, null)},
     function _get(coll, k, v) { return coll.has(k) ? coll.get(k) : reduce((acc, [mk,mv])=>(eq(k, mk) ? reduced(mv) : v), v, coll)}],

    Set,
    [function _get(coll, k) { return Lookup._get(coll, k, null)},
     function _get(coll, k, v) { return coll.has(k) ? k : reduce((acc, o)=>(eq(k, o) ? reduced(o) : v), v, coll)}],

    HashSet,
    [function _get(coll, o) { return coll.has(o) ? o : null },
     function _get(coll, o, fallback) { return coll.has(o) ? o : fallback }],

    Array,
    [function _get(arr, idx) { return idx in arr ? arr[idx] : null },
     function _get(arr, idx, fallback) { return idx in arr ? arr[idx] : fallback}],

    Object.getPrototypeOf(Int8Array),
    [function _get(arr, idx) { return idx in arr ? arr[idx] : null },
     function _get(arr, idx, fallback) { return idx in arr ? arr[idx] : fallback}],

    ArrayBuffer,
    [function _get(arr, idx) {
        throw new Error("Wrap a js:ArrayBuffer in a typed array (e.g. Uint8Array) to access its elements.")
    },
     function _get(arr, idx, fallback)  {
         throw new Error("Wrap a js:ArrayBuffer in a typed array (e.g. Uint8Array) to access its elements.")
     }],

    Module,
    [function _get(mod, k) { return Lookup._get(mod, k, null)},
     function _get(mod, k, fallback) { return mod.lookup(name(k)) || fallback }],
);

MutableAssociative.extend(
    Array,
    [function _assoc_$BANG$_(a, k, v) {
        a[k] = v;
        return a
    },
     function _dissoc_$BANG$_(a, k) {
         delete a[k];
         return a
     }],

    ArrayBuffer,
    [function _assoc_$BANG$_(a, k, v) {
        throw new Error("js:ArrayBuffer can't be modified directly, create a wrapping TyppedArray (e.g. Uint8Array)")
    },
     function _dissoc_$BANG$_(a, k) {
         throw new Error("js:ArrayBuffer can't be modified directly, create a wrapping TyppedArray (e.g. Uint8Array)")
     }],

    // hidden TypedArray class
    Object.getPrototypeOf(Int8Array),
    [function _assoc_$BANG$_(a, k, v) {
        a[k] = v;
        return a
    },
     function _dissoc_$BANG$_(a, k) {
         delete a[k];
         return a
     }],

    Object,
    [function _assoc_$BANG$_(o, k, v) {
        o = (o == null) ? {} : o;
        const n = js_symbol_p(k) ? k : name(k);
        o[n] = v;
        return o
    },
     function _dissoc_$BANG$_(o, k) {
         const n = js_symbol_p(k) ? k : name(k);
         delete o[n];
         return o
     }]
);

MutableCollection.extend(
    Array,
    [function _conj_$BANG$_(arr, el) {
        arr.push(el);
        return arr
    }],

    Map,
    [function _conj_$BANG$_(m, el) {
        const [k, v] = el;
        return m.set(k, v)
    }],

    Set,
    [function _conj_$BANG$_(s, el) {
        return s.add(el)
    }],

    Object,
    [function _conj_$BANG$_(o, el) {
        const [k, v] = el;
        o[name(k)] = v;
        return o}]
);

Named.extend(
    AbstractIdentifier,
    [function _name(self) { return self.identifier_str() }]
);

Repr.extend(
    Number, [function _repr(self) {return self.toString()}],
    String, [function _repr(self) {return `"${self.replaceAll('"', '\\"')}"`}],
    null, [function _repr(self) {return "nil"}],
    Boolean, [function _repr(self) {return self.toString()}],
    Symbol, [function _repr(self) {return `#js:Symbol \"${self.description}\"`}],
    Array,  [function _repr(self) {return `#js ${array_str(self)}`}],
    RegExp, [function _repr(self) {return `%r${self.toString()}${self.modifiers || ""}`}],

    ArrayBuffer, [function _repr(self) {return `#js:ArrayBuffer ${array_str(new Uint8Array(self))}`}],
    // hidden TypedArray class
    Object.getPrototypeOf(Int8Array),
    [function _repr(self) {return `#js:${self.constructor.name} ${array_str(self)}`}],

    Map,
    [function _repr(self) {
        return `#js:Map {${Array.from(self, ([k,v])=>[print_str(k), print_str(v)].join(" ")).join(", ")}}`
    }],

    Set,
    [function _repr(self) {
        return `#js:Set {${Array.from(self, (o)=>print_str(o)).join(", ")}}`
    }],

    Dict,
    [function _repr(self) {
        return `{${Array.from(self, ([k,v])=>[print_str(k), print_str(v)].join(" ")).join(", ")}}`
    }],

    HashSet,
    [function _repr(self) {
        return `#{${Array.from(self, (o)=>print_str(o)).join(", ")}}`
    }],

    QName, [function _repr(qname) {
        if (eq(Derefable.deref(self.resolve("*qname-print-style*")), kw_compact) ) {
            return Context.contract(deref(self.resolve("*current-context*")), qname).toString()
        } else {
            return qname.toString()
        }
    }],
    AbstractIdentifier, [function _repr(self) { return self.toString() }],
    AbstractSeq, [function _repr(self) { return seq_str(self) }],

    Var, [function _repr(self) { return self.repr() }],

    Module, [function _repr(self) { return self.repr() }],
    Context, [function _repr(self) { return `#Context ${print_str(self.entries)}` }]
);

Seq.extend(
    null,
    [function _first(self) {return null},
     function _rest(self) {return null}],

    AbstractSeq,
    [function _first(self) {return self.first()},
     function _rest(self) {return self.rest()}]
);

Seqable.extend(
    null, [function _seq(self) {return null}],
    Object, [function _seq(self) {return IteratorSeq.of_iterable(Object.entries(self))}],
    String, [function _seq(self) {return IteratorSeq.of_iterable(self)}],
    Array, [function _seq(self) {return IteratorSeq.of_iterable(self)}],
    Map, [function _seq(self) {return IteratorSeq.of_iterable(self)}],
    Set, [function _seq(self) {return IteratorSeq.of_iterable(self)}],

    Dict, [function _seq(self) {return IteratorSeq.of_iterable(self)}],
    HashSet, [function _seq(self) {return IteratorSeq.of_iterable(self)}],
    AbstractSeq, [function _seq(self) {return self.seq()}],
    Module, [function _seq(self) { return seq(self.seq())}],
    ArrayBuffer, [function _seq(self) {return IteratorSeq.of(new Uint8Array(self).values())}],

    // hidden TypedArray class
    Object.getPrototypeOf(Int8Array),
    [function _seq(self) {return IteratorSeq.of(self.values())}]
);

Sequential.extend(
    Array, [],
    AbstractSeq, []
);

WithMeta.extend(
    AbstractIdentifier, [function _with_meta(identifier, metadata) {return identifier.with_meta(metadata) }],
    Dict, [function _with_meta(dict, metadata) {return dict.with_meta(metadata)}],
    Keyword, [function _with_meta(kw, metadata) {return kw.with_meta(metadata)}],
    Cons, [function _with_meta(c, metadata) {return c.with_meta(metadata)}],
    List, [function _with_meta(list, metadata) {return list.with_meta(metadata)}],
    HashSet, [function _with_meta(set, metadata) {return set.with_meta(metadata)}],
    // Array, [function _with_meta(arr, metadata) {
    //     if (!eq2(meta(arr), metadata))
    //         return set_meta(Array.from(arr), meta(arr))
    //     return arr
    // }],
);

Walkable.extend(
    Array, [function _walk(self, f) { return Array.from(self, (o)=>f(o)) }],
    Map, [function _walk(self, f) { return new Map(Array.from(self, ([k, v])=>[f(k),f(v)])) }],
    AbstractSeq, [(function _walk(self, f) { return map(f, self) })],
    Dict, [function _walk(self, f) { return Array.from(self, ([k, v])=>[f(k),f(v)]).reduce((acc, [k, v])=>assoc(acc, k, v), dict()) }],
    Set, [function _walk(self, f) { return new Set(meta(self), map(f, self)) }],
    HashSet, [function _walk(self, f) { return HashSet.of(meta(self), ...map(f, self)) }]
);

QualifiedName.extend(
    QName,   [function _fqn(self) { return self.fqn }],
    QSym,    [function _fqn(self) { return self.fqn }],
    Var,     [function _fqn(self) { return self.fqn }],
    Package, [function _fqn(self) { return self.name }],
    Module,  [function _fqn(self) { return self.fqn.toString() }],
);

AbstractSeq.prototype[Symbol.iterator] = function() {
    return new SeqIterator(this)
};

// Copyright (c) Arne Brasseur 2023. All rights reserved.


qsym(`${PIGLET_PKG}:lang:*compiler*`);
const current_context_qsym = qsym(`${PIGLET_PKG}:lang:*current-context*`);
const current_module_qsym  = qsym(`${PIGLET_PKG}:lang:*current-module*`);
const first_qsym           = qsym(`${PIGLET_PKG}:lang:first`);
const get_qsym             = qsym(`${PIGLET_PKG}:lang:get`);
const intern_qsym          = qsym(`${PIGLET_PKG}:lang:intern`);
const rest_qsym            = qsym(`${PIGLET_PKG}:lang:rest`);

const quote_sym = symbol('quote');
const def_sym   = symbol('def');
const fn_sym    = symbol('fn');
symbol('while');

const as_kw       = keyword("as");
const async_kw    = keyword("async");
const col_kw      = keyword("col");
const doc_kw      = keyword("doc");
const end_kw      = keyword("end");
const file_kw     = keyword("file");
const line_kw     = keyword("line");
const location_kw = keyword("location");
const macro_kw    = keyword("macro");
const or_kw       = keyword("or");
const start_kw    = keyword("start");
const arities_kw  = keyword("arities");
const more_kw     = keyword("more");
function current_context() { return resolve(current_context_qsym).deref() }

function is_sym_name(sym, name) {
    return symbol_p(sym) && sym._id_str === name
}

function is_kw_name(kw, name) {
    return keyword_p(kw) && kw._id_str === name
}

class ASTNode {
    constructor(form) {
        Object.defineProperty(this, 'form', {value: form, enumerable: false});
        set_meta(this, meta(form));
    }
    static from(form, analyzer) {
        return new this(form)
    }
    emit(cg) {
        if (this.children) {
            let result = [];
            this.children.map((c)=>{
                const estree = cg.emit(this, c);
                if (Array.isArray(estree))
                    result.push(...estree);
                else
                    result.push(estree);
            });
            return result
        }
        return cg.emit(this,this.form)
    }
}

Hashable.extend(
    ASTNode, [(function _hash_code(self) { return hash_code(self.form) })],
);

class FnExpr extends ASTNode {
    constructor(form, name, argv, body, metadata) {
        super(form);
        this.name = name;
        this.argv = argv;
        this.body = body;
        this.meta = metadata;
    }

    static recurs_p(form) {
        if (seq_p(form)) {
            const head = first(form);
            if (is_sym_name(head, "recur")) return true
            if (is_sym_name(head, "if")) return this.recurs_p(third(form)) || this.recurs_p(fourth(form))
            if (is_sym_name(head, "let")) return count(form) > 2 && this.recurs_p(last(form))
            if (is_sym_name(head, "do")) return this.recurs_p(last(form))
        }
        return false
    }

    static from(form, analyzer) {
        let name, argv, metadata;
        this.form = form;
        let [_, x, ...rest] = form;
        if (x instanceof Sym || x instanceof QSym) {
            name = x;
            metadata = meta(name);
            x = rest.shift();
        }
        metadata ||= dict();
        argv = Array.from(x);
        if (meta(x)) {
            argv = set_meta(Array.from(x), meta(x));
            for (const [k, v] of meta(x)) {
                metadata = metadata.assoc(k, v);
            }
        }
        let locals_stack = analyzer.capture_locals();
        try {
            const self = new this(form, name, [], [], metadata);
            analyzer.push_locals_no_gensym(name ? [name] : []);
            const varargs_p = argv.find((a)=>is_sym_name(a, "&"));

            ////// Args
            // No destructuring or varags? Emit plain function arguments
            if (argv.every(symbol_p) && !varargs_p) {
                // Push each arg separately, so they all get unique gensyms,
                // because JS doesn't like it if you reuse argument names, like
                // having multiple _ args
                self.argv = argv.map(a=>(analyzer.push_locals([a]), analyzer.analyze(a)));
            } else {
                // Any sort of destructuring? Emit a function without arguments,
                // and destructure js:arguments sequentially instead
                self.body.push(BindingPair.from([argv, symbol("js:arguments")], analyzer, ConstAssignment));
            }

            ////// Body
            // Support recur directly inside a fn/defn
            if (this.recurs_p(last(rest))) {
                const orig_loop_head = analyzer.loop_head;
                self.binding_syms = argv;
                analyzer.loop_head = self;
                self.body.push(LoopExpr.analyze_body(form, rest, analyzer));
                analyzer.loop_head = orig_loop_head;
            } else {
                self.body = self.body.concat(analyzer.analyze_forms(rest));
            }
            return new MetaExpr(form, self, dict(arities_kw, varargs_p ? [[argv.findIndex((a)=>is_sym_name(a,"&")), more_kw]] : [count(argv)]))
        } finally {
            analyzer.reset_locals(locals_stack);
        }
    }

    emit(cg) {
        return cg.function_expr(this, {name: this.name ? cg.identifier(this.name, munge(this.name.name)) : null,
                                       argv: this.argv.map(e=>e.emit(cg)),
                                       body: this.body.map(e=>e.emit(cg)),
                                       async_p: get(meta(this.name), async_kw)
                                      })
    }
}

class ConstantExpr extends ASTNode {
    constructor(form) {
        super(form);
        this.value = form;
    }
}

/**
 * Invoke a function with arguments
 */
class InvokeExpr extends ASTNode {
    constructor(form, fn, args) {
        super(form);
        this.fn = fn;
        this.args = args;
    }

    static from(form, analyzer) {
        const [fn, ...args] = form;
        return new this(form, analyzer.analyze_without_meta(fn), args.map(a=>analyzer.analyze(a)))
    }

    emit(cg) {
        return cg.function_call(this, cg.emit(this, this.fn), this.args.map(a=>cg.emit(this,a)))
    }
}

/**
 * Invoke a piglet var. Not strictly necessary since we can do a VarLookupExpr +
 * InvokeExpr, but making this a separate case allows us to specialize the code
 * gen for direct var invocations.
 */
class InvokeVarExpr extends ASTNode {
    constructor(form, the_var, args) {
        super(form);
        this.the_var = the_var;
        this.args = args;
    }

    static from(form, analyzer) {
        const [var_sym, ...args] = form;
        const the_var = resolve(var_sym);
        const arities = meta(the_var.value)?.get(arities_kw);
        if (arities) {
            const arity = args.length;
            if (!arities.find((a)=>Array.isArray(a) && arity >= a[0] || arity === a)) {
                console.log(`WARN: Wrong arity for ${var_sym}, expected ${arities.join(", ")}, got ${arity}`);
            }
        }
        return new this(form, the_var, args.map(a=>analyzer.analyze(a)))
    }
    emit(cg) {
        return cg.invoke_var(this, this.the_var.pkg, this.the_var.module, this.the_var.name, this.args.map(a=>cg.emit(this,a)))
    }
}

/**
 * Lookup of JS properties by using a symbol contains dots, like foo.bar.baz,
 * when used as a value rather than a function, so not in head position in a
 * list form.
 */
class HostVarExpr extends ASTNode {
    constructor(sym, parts) {
        super(sym);
        this.parts = parts;
    }

    static from(sym) {
        const parts = sym.name.split('.').reduce((acc, s)=>{
            const part = symbol(null, null, s);
            const [prev] = acc.slice(-1);
            part.start = prev ? prev.end+2 : sym.start;
            part.end   = part.start + part.name.length;
            part.line  = sym.line;
            part.col   = prev ? prev.col+2 : sym.col;
            return acc.concat([part])
        }, []);
        return new this(sym, parts)
    }

    emit(cg) {
        return cg.member_lookup(this, cg.identifier(this.parts[0], this.parts[0].name), this.parts.slice(1))
    }
}

/**
 * A bare JS identifier, e.g. for a local or global var.
 */
class JsIdentifierExpr extends ASTNode {
    constructor(form) {
        super(form);
        this.identifier = form;
    }
    emit(cg) {
        return cg.identifier(this, this.form)
    }
}

/**
 * Use of a piglet var as a value in an expression
 */
class VarLookupExpr extends ASTNode {
    emit(cg) {
        return cg.var_value(this, this.form)
    }
}

/**
 * Interop method call, i.e. starts with a `.`, like `(.foo bar)`
 */
class MethodExpr extends ASTNode {
    constructor(form, method, object, args) {
        super(form);
        this.method = method;
        this.object = object;
        this.args = args;
    }

    static from(form, analyzer) {
        const [f1, f2, ...rest] = form;
        const method = symbol(null, null, f1.name.slice(1)); // chop off the "."
        Object.assign(method, {start: f1.start, end: f1.end, line: f1.line, col: f1.col});
        const object  = analyzer.analyze(f2);
        const args = rest.map(f=>analyzer.analyze(f));
        return new this(form, method, object, args)
    }

    emit(cg) {
        return cg.method_call(this, this.method, this.object.emit(cg), this.args.map(a=>cg.emit(this,a)))
    }
}

class MemberExpr extends ASTNode {
    constructor(form, object, parts) {
        super(form);
        this.object = object;
        this.parts = parts;
    }

    static from(form, analyzer) {
        const [f1, f2] = form;
        const parts = f1.name.slice(2).split('.').reduce((acc, s)=>{
            const part = symbol(null, null, s);
            const [prev] = acc.slice(-1);
            part.start = prev ? prev.end+2 : f1.start;
            part.end   = part.start + part.name.length;
            part.line  = f1.line;
            part.col   = prev ? prev.col+2 : f1.col;
            return acc.concat([part])
        }, []);
        const object  = analyzer.analyze(f2);
        return new this(form, object, parts)
    }

    emit(cg) {
        return cg.member_lookup(this, this.object.emit(cg), this.parts)
    }
}

//*******************************

/**
 * (def xxx 123)
 * Emits a call to piglet:lang:intern. A single instance is created for each
 * var, in case of destructuring forms
 */
class VarAssignment extends ASTNode {
    constructor(form, var_sym, value, meta) {
        super(form);
        this.var_sym = var_sym;
        this.value = value;
        this.meta = meta;
    }

    static meta_keys = [start_kw, end_kw, col_kw, line_kw, file_kw, location_kw]

    static from(form, analyzer, var_sym, rhs_form) {
        const meta_form = reduce(conj, meta(var_sym) || dict(), select_keys(meta(form), this.meta_keys));
        return new this(form, var_sym, analyzer.analyze(rhs_form), analyzer.analyze_without_meta(meta_form))
    }

    emit(cg) {
        return cg.define_var(this, this.var_sym, cg.emit(this, this.value), cg.emit(this, this.meta))
    }
}

/**
 * Base for any "plain" JS assigment (let foo = ... / const foo = ... / foo = ...)
 */
class AssignmentBase extends ASTNode {
    constructor(form, lhs_expr, rhs_expr) {
        super(form);
        this.lhs_expr = lhs_expr;
        this.rhs_expr = rhs_expr;
    }

    static from(form, analyzer, var_sym, rhs_form) {
        const rhs_expr = analyzer.analyze(rhs_form);
        analyzer.push_locals([var_sym]);
        const lhs_expr = analyzer.analyze(var_sym);
        return new this(form, lhs_expr, rhs_expr)
    }

    emit(cg) {
        return cg[this.constructor.code_gen_method](this, cg.emit(this, this.lhs_expr), cg.emit(this, this.rhs_expr))
    }
}

/**
 * `const foo = ...`
 */
class ConstAssignment extends AssignmentBase {
    static code_gen_method = 'const_var_decl'
}

/**
 * `let foo = ...`
 * Not calling this LetAssignment so we don't confuse it with `(let ...)`
 */
class MutableAssignment extends AssignmentBase {
    static code_gen_method = 'let_var_decl'
}

/**
 * `foo = ...`
 */
class Reassignment extends AssignmentBase {
    static code_gen_method = 'assignment'

    static from(form, analyzer, var_sym, rhs_form) {
        return new this(form, analyzer.analyze(var_sym), analyzer.analyze(rhs_form))
    }
}

/**
 * A single [lhs rhs] assignment pair, possibly with destructuring. See
 * subclasses for concrete cases.
 */
class BindingPair extends ASTNode {
    static from(pair, analyzer, Assignment) {
        const [lhs, rhs] = pair;
        set_meta(pair, meta(lhs));
        const PairType = (symbol_p(lhs) ? SymbolBinding :
                          vector_p(lhs) ? VectorBinding :
                          dict_p(lhs) ? DictBinding : null);
        if (!PairType)
            throw new Error(`Left-hand side of binding pair must be symbol, vector, or dict, got ${inspect(lhs)}`)
        return PairType.from(pair, lhs, rhs, analyzer, Assignment)
    }
}

/**
 * Simple assigment like (def foo ...) or (let [foo ...]), all destructuring
 * eventually comes down to this base case.
 */
class SymbolBinding extends BindingPair {
    static from(pair, lhs, rhs, analyzer, Assignment) {
        const self = new this(pair);
        self.children = [Assignment.from(pair, analyzer, lhs, rhs)];
        return self
    }
}

/**
 * Assignment where the lhs is a vector, i.e. sequential destructuring, possibly
 * with splat (`&`) and `:as`
 */
class VectorBinding extends BindingPair {
    static find_as(lhs) {
        let new_lhs = [];
        let as = null;
        while (lhs) {
            if (is_kw_name(first(lhs), "as")) {
                lhs = rest(lhs);
                if (!lhs) {
                    throw new Error(":as must be followed by a symbol, found end of destructuring form")
                }
                as = first(lhs);
            } else {
                new_lhs.push(first(lhs));

            }
            lhs = rest(lhs);
        }
        return [new_lhs, as]
    }

    static from(pair, lhs_orig, rhs, analyzer, Assignment) {
        const self         = new this(pair);
        const carrier_sym  = gensym("seq-carrier");

        let [lhs, as_sym] = this.find_as(lhs_orig);

        analyzer.push_locals_no_gensym([carrier_sym]);
        if (as_sym) analyzer.push_locals([as_sym]);

        // We assign a mutable local "carrier", which is used to traverse the seq with first/rest
        // If there's an `:as` then we first assign the rhs to a constant so we can access it when
        // we encounter the `:as`
        self.children = as_sym ?
            [ConstAssignment.from(pair, analyzer, as_sym, rhs),
             MutableAssignment.from(pair, analyzer, carrier_sym, as_sym)]
            : [MutableAssignment.from(pair, analyzer, carrier_sym, rhs)];

        while (lhs) {
            if (is_sym_name(first(lhs), "&")) {
                lhs = rest(lhs); // skip &
                if (count(lhs) !== 1) {
                    throw new Error("A splat (&) in a binding form must be followed by exactly one binding form.")
                }
                self.children.push(BindingPair.from([first(lhs), carrier_sym], analyzer, Assignment));
            } else {
                // [carrier (rest carrier)
                //  first-lhs (first carrier)]
                self.children.push(BindingPair.from([first(lhs), list(first_qsym, carrier_sym)], analyzer, Assignment));
                if(count(lhs) > 1)
                    self.children.push(Reassignment.from(first(lhs), analyzer, carrier_sym, list(rest_qsym, carrier_sym)));
            }
            lhs = rest(lhs);
        }

        return self
    }
}

/**
 * Assignment where the lhs is a dict literal, i.e. associative destructuring,
 * supporting `:keys` / `:syms` / `:strs`
 */
class DictBinding extends BindingPair {
    static from(pair, lhs, rhs, analyzer, Assignment) {
        const self   = new this(pair);
        const as_sym = lhs.get(as_kw, gensym("dict-as"));
        const or_dict = lhs.get(or_kw, dict());

        analyzer.push_locals([as_sym]);
        self.children = [ConstAssignment.from(pair, analyzer, as_sym, rhs)];
        lhs = lhs.dissoc(as_kw).dissoc(or_kw);

        const push_const_binding = (lhs, rhs) => {
            if (!symbol_p(lhs)) throw new Error(`Dict destructuring, expected symbols, got ${inspect(lhs)}.`)
            analyzer.push_locals([lhs]);
            self.children.push(ConstAssignment.from(lhs, analyzer, lhs, list(get_qsym, as_sym, rhs, or_dict.get(lhs))));
        };

        for (const [k, v] of lhs) {
            if (k instanceof Keyword) {
                if (!vector_p(v)) throw new Error(`Dict destructuring ${k}, expected vector value, got ${inspect(v)}.`)
                for (const sym of v) {
                    push_const_binding(sym,
                                       k.name === "strs" ? sym.name
                                       : k.name === "keys" ? keyword(sym.name)
                                       : k.name === "syms" ? list(quote_sym, symbol(sym.name))
                                       : (()=>{throw new Error(`Dict destructuring, expected :keys, :strs, or :syms. Got ${k}.`)})());

                }
            } else if (k instanceof PrefixName) ; else if (k instanceof QName) ; else if (k instanceof QSym) ; else {
                self.children.push(BindingPair.from([k, list(get_qsym, as_sym, v)], analyzer, Assignment));
            }
        }
        return self
    }
}

//////////////////////////////////////////////////////////////////////
// Binding contexts

class DefExpr extends ASTNode {
    constructor(form, bind_expr) {
        super(form);
        this.bind_expr = bind_expr;
    }
    static from(form, analyzer) {
        let [_def, binding, ...body] = form;
        const arity = count(form);
        if (arity !== 3 && arity !== 4) {
            throw new Error(`Wrong number of arguments to def, ${print_str(form)}`)
        }
        let doc = null;
        if (arity === 4) {
            if (!string_p(first(body))) {
                throw new Error(`Expected a docstring as the second argument to def, got ${print_str(first(body))}`)
            }
            doc = first(body);
            body = rest(body);
        }
        const binding_pair = [doc ? vary_meta(binding, assoc, doc_kw, doc) : binding, first(body)];
        const declarator = BindingPair.from(binding_pair, analyzer, VarAssignment);
        return new this(form, declarator)
    }

    emit(cg) {
        return cg.emit(this, this.bind_expr)
    }

}

class LetExpr extends ASTNode {
    constructor(form, children) {
        super(form);
        this.children = children;
    }
    static from(form, analyzer) {
        let [_, bindings, ...body] = form;
        const children = [];
        if (count(bindings) % 2 !== 0) {
            throw new Error("Invalid let: binding vector requires even number of forms")
        }
        const binding_pairs = partition_n(2, bindings);
        let locals_stack = analyzer.capture_locals();
        try {
            binding_pairs.map(binding_pair => {
                children.push(BindingPair.from(binding_pair, analyzer, ConstAssignment));
            });
            children.push(...analyzer.analyze_forms(body));
        } finally {
            analyzer.reset_locals(locals_stack);
        }
        return new this(form, children)
    }
}

class MacroVarExpr extends ASTNode {
    constructor(form, var_sym, argv, body) {
        super(form);
        this.var_sym = var_sym;
        this.argv = argv;
        this.body = body;
    }
    static from(form, analyzer) {
        let [_defmacro, var_sym, ...more] = form;
        let expanded_form = null;
        if (string_p(first(more))) {
            expanded_form = list(def_sym, vary_meta(var_sym, assoc, macro_kw, true), first(more), list_STAR(fn_sym, second(more), rest(rest(more))));
        } else {
            expanded_form = list(def_sym, vary_meta(var_sym, assoc, macro_kw, true), list_STAR(fn_sym, first(more), rest(more)));
        }
        return analyzer.analyze(expanded_form)
    }
}

//////////////////////////////////////////////////////////////////////

class QuoteExpr extends ASTNode {
    emit(cg) {
        const [_, form] = this.form;
        return cg.emit(this, form)
    }
}

class IfExpr extends ASTNode {
    constructor(form, test, if_branch, else_branch) {
        super(form);
        this.test = test;
        this.if_branch = if_branch;
        this.else_branch = else_branch;
    }
    static from(form, analyzer) {
        const [_, test, if_branch, else_branch] = form;

        return new this(
            form,
            analyzer.analyze(list(symbol("piglet:lang:truthy?"), test)), // TODO: check for boolean tag
            analyzer.analyze(if_branch),
            else_branch ? analyzer.analyze(else_branch) : null
        )
    }
    emit(cg) {
        return cg.conditional(this, this.test.emit(cg), this.if_branch.emit(cg), this.else_branch?.emit(cg))
    }
}

class IfStmt extends IfExpr {
    emit(cg) {
        return cg.if_stmt(this, this.test.emit(cg), this.if_branch.emit(cg), this.else_branch?.emit(cg))
    }
}

class AwaitExpr extends ASTNode {
    constructor(form, arg) {
        super(form);
        this.arg = arg;
    }
    static from(form, analyzer) {
        const [_, arg] = form;
        return new this(form, analyzer.analyze(arg))
    }
    emit(cg) {
        return cg.await_expr(this, cg.emit(this, this.arg))
    }
}

class SpecialSymbolExpr {
    static SPECIALS = {
        "true": true,
        "false": false,
        "nil": null,
        "undefined": void(0)
    }

    constructor(form, value) {
        this.form = form;
        this.value = value;
    }
    static from(form) {
        return new this(form, this.SPECIALS[form.name])
    }
    static is_special(s) {
        return s in this.SPECIALS
    }
    emit(cg) {
        return cg.literal(this, this.value)
    }
}

const INFIX_OPERATORS = {
    "+": "+",
    "*": "*",
    "/": "/",
    "<": "<",
    ">": ">",
    ">=": ">=",
    "<=": "<=",
    "mod": "%",
    "power": "**",
    "==": "==",
    "===": "===",
    "!==": "!==",
    "instance?": "instanceof",
    "and": "&&",
    "or": "||",
    "bit-shift-left": "<<",
    "bit-shift-right": ">>",
    "bit-and": "&",
    "bit-or": "|",
    "bit-xor": "^",
};

const BOOLEAN_INFIX_OPERATORS = ["<", ">", "<=", ">=", "==", "===", "instanceof", "&&", "||"];

const UNARY_OPERATORS = {
    "typeof": "typeof",
    // TODO: we can only emit this when we know we have a true boolean, if not we must go through truthy?
    // "not": "!"
};

class InfixOpExpr extends ASTNode {
    constructor(form, op, args) {
        super(form);
        this.op = op;
        this.args = args;
    }
    static from(form, analyzer) {
        const [op, ...rest] = form;
        return new this(form, INFIX_OPERATORS[op.name], rest.map(e=>analyzer.analyze(e)))
    }
    emit(cg) {
        if (this.op === 'instanceof') {
            return cg.infix_op(this, this.op, this.args.reverse().map(a=>cg.emit(this,a)))
        }
        if (BOOLEAN_INFIX_OPERATORS.includes(this.op)) {
            return cg.boolean_infix_op(this, this.op, this.args.map(a=>cg.emit(this,a)))
        }
        return cg.infix_op(this, this.op, this.args.map(a=>cg.emit(this,a)))
    }
}

class UnaryOpExpr extends ASTNode {
    constructor(form, op, argument) {
        super(form);
        this.op = op;
        this.argument = argument;
    }
    static from(form, analyzer) {
        const [op, arg] = form;
        return new this(form, UNARY_OPERATORS[op.name], analyzer.analyze(arg))
    }
    emit(cg) {
        return cg.unary_expression(this, this.op, cg.emit(this.argument, this.argument), true)
    }
}

class NewExpr extends ASTNode {
    constructor(form, ctor, args) {
        super(form);
        this.ctor = ctor;
        this.args = args;
    }
    static from(form, analyzer) {
        const [_, ctor, ...rest] = form;
        return new this(form, analyzer.analyze(ctor), rest.map(e=>analyzer.analyze(e)))
    }
    emit(cg) {
        return cg.new_expr(this, cg.emit(this, this.ctor), this.args.map(a=>cg.emit(this,a)))
    }
}

class VectorExpr extends ASTNode {
    constructor(form, coll) {
        super(form);
        this.coll = coll;
    }
    static from(form, analyzer) {
        return new this(form, analyzer.analyze_forms(form))
    }
    emit(cg) {
        return cg.emit(this, this.coll)
    }
}

class DictExpr extends ASTNode {
    constructor(form, dict) {
        super(form);
        this.dict = dict;
    }
    static from(form, analyzer) {
        return new this(
            form,
            with_meta(
                reduce((d, [k, v])=>Associative._assoc(d, analyzer.analyze(k), analyzer.analyze(v)),
                       Dict.EMPTY,
                       form),
                meta(form)
            )
        )
    }
    emit(cg) {
        return cg.emit(this, this.dict)
    }
}

class HashSetExpr extends ASTNode {
    constructor(form, set) {
        super(form);
        this.set = set;
    }
    static from(form, analyzer) {
        return new this(
            form,
            HashSet.of(meta(form), ...map(analyzer.analyze.bind(analyzer), form))
        )
    }
    emit(cg) {
        return cg.emit(this, this.set)
    }
}

class JsObjLiteral extends ASTNode {
    constructor(form, obj) {
        super(form);
        this.obj = obj;
    }
    static from(form, analyzer) {
        return new this(
            form,
            Array.from(Object.entries(form)).reduce((acc, [k, v])=>(acc[k]=analyzer.analyze(v), acc), {})
        )
    }
    emit(cg) {
        return cg.object_literal(this, Object.entries(this.obj).map(([k, v]) => [cg.emit(k, k), cg.emit(v, v)], {}))
    }
}

class SetExpr extends ASTNode {
    constructor(form, left, right) {
        super(form);
        this.left = left;
        this.right = right;
    }
    static from(form, analyzer) {
        const [_, left, right] = form;
        return new this(form, analyzer.analyze(left), analyzer.analyze(right))
    }
    emit(cg) {
        return cg.assignment(this, cg.emit(this, this.left), cg.emit(this, this.right))
    }
}

class DoExpr extends ASTNode {
    constructor(form, body) {
        super(form);
        this.body = body;
    }
    static from(form, analyzer) {
        const [_, ...rest] = form;
        return new this(form, analyzer.analyze_forms(rest))
    }
    emit(cg) {
        if (this.body.length === 1)
            return cg.emit(this.body[0], this.body[0])
        return this.body.map((e) => cg.emit(this, e))
    }
}

class ModuleExpr extends ASTNode {
    constructor(form, children) {
        super(form);
        this.children = children;
    }
    static from(form, analyzer) {
        // console.log(`Analyzing module form, current-module=${current_module().inspect()}, analyzing=${Array.from(form)[1].inspect()}`)
        const current_package = deref(resolve(symbol('piglet:lang:*current-package*')));
        Module.parse_opts(current_package.name, form);
        // const interned_mod = ensure_module(current_package, mod_opts.get('name'))
        const interned_mod = module_registry.parse_module_form(current_package, form);
        interned_mod.location = deref(resolve(symbol('piglet:lang:*current-location*')));
        try {
            analyzer.push_locals([interned_mod.self_ref]);
            const analyze = analyzer.analyze.bind(analyzer);
            const self = interned_mod.self_ref;
            const children = [
                (new ConstAssignment(
                    form,
                    analyzer.analyze(self),
                    analyze(
                        list(symbol('.register_module'),
                             symbol('piglet:lang:module-registry'),
                             list(quote_sym,
                                  {pkg: interned_mod.pkg,
                                   name: interned_mod.name,
                                   imports: interned_mod.imports.map((({alias, from})=>({alias:alias, from: from.fqn}))),
                                   context: interned_mod?.context,
                                   location: interned_mod.location,
                                   self_ref: self}))
                    ),
                    null)
                ),

                analyze(list(intern_qsym,
                             list(quote_sym, current_module_qsym),
                             self)),
                analyze(list(intern_qsym,
                             list(quote_sym, current_context_qsym),
                             list(symbol('.-context'), interned_mod.self_ref))),
                ...(interned_mod.imports.map(({from, alias, js_module, module_path})=>{
                    if (js_module) {
                        return analyze(
                            list(symbol('.set_alias'),
                                 self,
                                 alias.name,
                                 list(symbol('await'),
                                      list(symbol('piglet:lang:js-import'), module_path)))
                        )
                    }
                    return analyze(list(symbol('await'), list(symbol('piglet:lang:require'), list(symbol("quote"), from.fqn))))
                })),
                self
            ];
            return new this(form, children)
        } finally {
            analyzer.pop_locals();
        }
    }
}

class ThrowExpr extends ASTNode {
    constructor(form, argument) {
        super(form);
        this.argument = argument;
    }
    static from(form, analyzer) {
        return new this(form, analyzer.analyze(second(form)))
    }
    emit(cg) {
        return cg.throw_stmt(this, cg.emit(this.argument, this.argument))
    }
}

class VarExpr extends ASTNode {
    emit(cg) {
        return cg.var_ref(this, second(this.form))
    }
}

class WhileExpr extends ASTNode {
    constructor(form, test, body) {
        super(form);
        this.test = test;
        this.body = body;
    }
    static from(form, analyzer) {
        const [test, ...body] = analyzer.analyze_forms(rest(form));
        return new this(form, test, body)
    }
    emit(cg) {
        return cg.while_stmt(this, cg.emit(this.test, this.test), this.body.map((o)=>cg.emit(o,o)))
    }
}

class MetaExpr extends ASTNode {
    constructor(form, analyzed_form, meta) {
        super(form);
        this.analyzed_form = analyzed_form;
        this.meta = meta;
    }
    static from(form, analyzed_form, analyzer) {
        const meta_form = meta(form);
        if (meta_form == null) {
            return analyzed_form
        }
        analyzer.emit_meta = false;
        const meta_expr = analyzer.analyze(meta_form);
        analyzer.emit_meta = true;
        return new this(form, analyzed_form, meta_expr)
    }
    emit(cg) {
        return cg.wrap_set_meta(
            cg.emit(this.form, this.analyzed_form),
            this.meta
        )
    }
}

class TryExpr extends ASTNode {
    constructor(form, body,
                catch_form, catch_arg, catch_body,
                finalizer_form, finalizer_body) {
        super(form);
        this.body = body;
        this.catch_form = catch_form;
        this.finalizer_form = finalizer_form;
        this.catch_arg = catch_arg;
        this.catch_body = catch_body;
        this.finalizer_body = finalizer_body;
    }
    static from(form, analyzer) {
        let catch_form, catch_arg, catch_body, finalizer_form, finalizer_body, body, f;
        body = rest(form);
        f = last(body);
        if (seq_p(f) && is_sym_name(first(f), "finally")) {
            body = butlast(body);
            finalizer_form = f;
            finalizer_body = analyzer.analyze_forms(rest(finalizer_form));
            f = last(body);
        }
        if (seq_p(f) && is_sym_name(first(f), "catch")) {
            body = butlast(body);
            catch_form = f;
            f = rest(f);
            catch_arg = first(f);
            analyzer.push_locals([catch_arg]);
            try {
                catch_arg = analyzer.analyze_without_meta(catch_arg);
                catch_body = analyzer.analyze_forms(rest(f));
            } finally {
                analyzer.pop_locals([catch_arg]);
            }
        }
        body = analyzer.analyze_forms(body);
        return new this(form, body,
                        catch_form, catch_arg, catch_body,
                        finalizer_form, finalizer_body)
    }
    emit(cg) {
        return cg.try_stmt(this.form, this.body,
                           this.catch_form, this.catch_arg, this.catch_body,
                           this.finalizer_form, this.finalizer_body)
    }
}

class LoopExpr extends ASTNode {
    constructor(form, binding_syms) {
        super(form);
        this.binding_syms = binding_syms;
        this.children = [];
    }

    /**
     * Derived analyzer instance which overrides `analyze_forms`, which is used
     * for the body part of a `do` or `let`, to handle the final form
     * differently.
     */
    static make_tail_analyzer(analyzer) {
        const tail_analyzer = Object.create(analyzer);
        tail_analyzer.analyze_forms =
            (forms)=>(analyzer
                      .analyze_forms(butlast(forms))
                      .concat(LoopExpr.analyze_tail_form(last(forms), analyzer)));
        return tail_analyzer
    }

    /**
     * Handle `recur` in tail position
     */
    static analyze_tail_form(form, analyzer) {
        form = analyzer.macroexpand(form);
        if (seq_p(form)) {
            const initial = first(form);
            if (initial instanceof Sym && initial.mod == null) {
                switch (initial.name) {
                case "if":
                    const [_if, test, consequent, alt] = form;
                    return new IfStmt(form,
                                      analyzer.analyze(test),
                                      this.analyze_tail_form(consequent, analyzer),
                                      this.analyze_tail_form(alt, analyzer))
                case "recur":
                    return RecurExpr.from(form, analyzer)
                case "do":
                    return DoExpr.from(form, this.make_tail_analyzer(analyzer))
                case "let":
                    return LetExpr.from(form, this.make_tail_analyzer(analyzer))
                }
            }
        }
        return new ReturnStmt(form, analyzer.analyze(form))
    }

    static analyze_body(form, body, analyzer) {
        return (new WhileExpr(form,
                              new ConstantExpr(true),
                              analyzer
                              .analyze_forms(butlast(body))
                              .concat([this.analyze_tail_form(last(body), analyzer)])))
    }

    static from(form, analyzer) {
        let [_loop, bindings, ...body] = form;
        if (count(bindings) % 2 !== 0) {
            throw new Error("Invalid loop: binding vector requires even number of forms")
        }
        const binding_pairs = partition_n(2, bindings);
        const self = new this(form, Array.from(binding_pairs, first));

        let locals_stack = analyzer.capture_locals();
        try {
            binding_pairs.map(binding_pair => {
                self.children.push(BindingPair.from(binding_pair, analyzer, MutableAssignment));
            });
            const orig_loop_head = analyzer.loop_head;
            analyzer.loop_head = self;
            self.children.push(this.analyze_body(form, body, analyzer));
            analyzer.loop_head = orig_loop_head;
        } finally {
            analyzer.reset_locals(locals_stack);
        }
        return self
    }

    emit(cg) {
        return cg.wrap_iife(this.form, this.children.map((c)=>cg.emit(c,c)))
    }
}

class RecurExpr extends ASTNode {
    constructor(form) {
        super(form);
    }
    static from(form, analyzer) {
        const binding_syms = analyzer.loop_head.binding_syms;
        const self = new this(form);
        self.children = Array.from(map((lhs, rhs)=>BindingPair.from([lhs, rhs], analyzer, Reassignment), binding_syms, rest(form)));
        self.children.push(ContinueStmt);
        return self
    }
}

class BreakStmt extends ASTNode {
    static from(form, analyzer) {
        return this
    }
    static emit(cg) {
        return cg.break_stmt()
    }
}

class ContinueStmt extends ASTNode {
    static from(form, analyzer) {
        return this
    }
    static emit(cg) {
        return cg.continue_stmt()
    }
}

class ReturnStmt extends ASTNode {
    constructor(form, expr) {
        super(form);
        this.expr = expr;
    }
    static from(form, analyzer) {
        return new this(form, analyzer.analyze(form))
    }
    emit(cg) {
        return cg.return_stmt(this.form, cg.emit(this.form, this.expr))
    }
}

let SPECIALS = {
    "fn": FnExpr,
    "def": DefExpr,
    "quote": QuoteExpr,
    "if": IfExpr,
    "defmacro": MacroVarExpr,
    // "array": ArrayExpr,
    "await": AwaitExpr,
    "new": NewExpr,
    "let": LetExpr,
    "set!": SetExpr,
    "do": DoExpr,
    "module": ModuleExpr,
    "throw": ThrowExpr,
    "var": VarExpr,
    "while": WhileExpr,
    "try": TryExpr,
    "loop": LoopExpr,
    "break": BreakStmt,
    "continue": ContinueStmt,
};

class Analyzer {
    constructor() {
        this.locals_stack = [];
        this.emit_meta = true;
    }

    analyze(form) {
        const expr = this.analyze_without_meta(form, this);
        if (!this.emit_meta) { return expr }
        const t = expr.constructor;
        if (VectorExpr === t || DictExpr === t || QuoteExpr === t) {
            return MetaExpr.from(form, expr, this)
        }
        // if (ConstantExpr == t) {
        //     const tc = expr.form.constructor
        //     if (Keyword === tc || Symbol === tc) {
        //         return MetaExpr.from(form, expr, this)
        //     }
        // }
        return expr
    }

    /**
     * Analyze a sequence of forms, used anywhere where you have a "body" with
     * multiple forms
     */
    analyze_forms(forms) {
        return Array.from(forms || [], f=>this.analyze(f))
    }

    analyze_without_meta(form) {
        form = prewalk((f)=>{
            if (seq_p(f) && seq(f) && first(f) instanceof Sym && first(f).name.endsWith(".")) {
                return cons(symbol("new"), cons(symbol(first(f).toString().slice(0, -1)), rest(f)))
            }
            if (f instanceof Sym) {
                if (!(f.name.startsWith(".")) && f.name.includes(".")) {
                    const parts = f.name.split(".");
                    return parts.slice(1).reduce((acc, part)=>list(symbol(`.-${part}`), acc), f.with_name(parts[0]))
                }
            }
            return f
        },form);

        if (seq_p(form)) {
            if (!seq(form)) {
                return QuoteExpr.from(list(symbol("quote"), form))
            }
            const initial = first(form);
            // console.log("initial", print_str(initial))
            if (initial instanceof Sym && initial.mod == null) {
                let expr_class;
                if (expr_class = SPECIALS[initial.name]) {
                    return expr_class.from(form, this)
                }
                if(initial.name in INFIX_OPERATORS && count(form) >= 3) {
                    return InfixOpExpr.from(form, this)
                }
                if(initial.name in UNARY_OPERATORS) {
                    return UnaryOpExpr.from(form, this)
                }
                if (initial.name.charAt(0) == ".") {
                    if (initial.name.charAt(1) == "-") {
                        return MemberExpr.from(form, this)
                    } else {
                        return MethodExpr.from(form, this)
                    }
                }
            }
            if (initial instanceof Sym || initial instanceof QSym) {
                const local = this.get_local(initial);
                if (local) {
                    return InvokeExpr.from(form, this)
                }
                if (initial.name.endsWith(".")) {
                    return NewExpr.from(cons(symbol("new"), cons(symbol(initial.toString().slice(0, -1)), rest(form))), this)
                }
                if (initial.pkg === PIGLET_PKG && initial.mod === "lang") {
                    let expr_class;
                    if (expr_class = SPECIALS[initial.name]) {
                        return expr_class.from(form, this)
                    }
                    if(initial.name in INFIX_OPERATORS) {
                        return InfixOpExpr.from(form, this)
                    }
                    if(initial.name in UNARY_OPERATORS) {
                        return UnaryOpExpr.from(form, this)
                    }
                }
                const the_var = resolve(initial);
                if (get(meta(the_var), macro_kw)) {
                    const expanded = the_var(...(rest(form) || []));
                    return (this.analyze(expanded))
                }
                if (the_var) {
                    return InvokeVarExpr.from(form, this)
                }
            }
            return InvokeExpr.from(form, this)
        }

        if (Array.isArray(form)) { // currently [...] reads as an array, that will likely change
            return VectorExpr.from(form, this)
        }

        if (dict_p(form)) {
            return DictExpr.from(form, this)
        }

        if (set_p(form)) {
            return HashSetExpr.from(form, this)
        }

        if (form instanceof Sym || form instanceof QSym) {
            if (form.mod === null) {
                const local = this.get_local(form);
                if (local) {
                    return JsIdentifierExpr.from(local)
                }
                if (SpecialSymbolExpr.is_special(form.name)) {
                    return SpecialSymbolExpr.from(form)
                }
            }
            if (form.pkg === null && form.mod === "js") {
                return HostVarExpr.from(form, this)
            }
            return VarLookupExpr.from(form, this)
        }

        if (form instanceof PrefixName) {
            return new ConstantExpr(Context.expand(current_context(), form))
        }

        if (form instanceof RegExp) {
            return new ConstantExpr(form)
        }

        if (form && typeof form === 'object' && !form.emit) {
            return JsObjLiteral.from(form, this)
        }

        return new ConstantExpr(form)
    }

    macroexpand(form) {
        if (seq_p(form)) {
            const initial = first(form);
            if ((initial instanceof Sym || initial instanceof QSym) && !this.get_local(initial)) {
                const the_var = resolve(initial);
                if (get(meta(the_var), macro_kw)) {
                    return the_var(...(rest(form) || []))
                }
            }
        }
        return form
    }

    get_local(sym) {
        let n = sym.name;
        for(var locals of this.locals_stack) {
            if(n in locals) {
                return locals[n]
            }
        }
        return false
    }

    /**
     * Push a list of local variables (symbols) onto the locals stack, so that
     * the analyzer knows that these symbols currently resolve to (JS) local
     * variables rather than piglet vars. This uses gensym to ensure locals are
     * unique in case of name reuse in nested contexts. Should be used
     * symmetrically with pop_locals to ensure a correct analyzer context.
     */
    push_locals(list) {
        this.locals_stack.unshift(Array.from(list).reduce((acc, s) => (acc[s.name]=munge(gensym(s.name).name), acc), {}));
    }

    /**
     * Like [[push_locals]], but forego gensym'ing, so the symbols are used as-is.
     */
    push_locals_no_gensym(list) {
        this.locals_stack.unshift(Array.from(list).reduce((acc, s) => (acc[s.name]=munge(s.name), acc), {}));
    }

    /**
     * Pop an entry off the locals stack. Should be called in a `finally` to
     * ensure that the analyzer doesn't get in a bad state after parse errors.
     */
    pop_locals() {
        this.locals_stack.shift();
    }

    /**
     * Get the current state of the locals stack as a value, which can be
     * restored with [[reset_locals]]
     */
    capture_locals() {
        return Array.from(this.locals_stack)
    }

    /**
     * Discard the current state of the locals stack, replacing it with the
     * given value, which presumably came from [[capture_locals]]. Should be
     * called in a `finally` to ensure that the analyzer doesn't get in a bad
     * state after parse errors.
     */
    reset_locals(locals_stack) {
        this.locals_stack = locals_stack;
    }
}

// Copyright (c) Arne Brasseur 2023. All rights reserved.


function expression_p(node) {
    return node.type.endsWith('Expression') ||
        node.type === 'Literal' ||
        node.type === 'Identifier'
}

function statement_p(node) {
    return node.type !== 'ExpressionStatement' && !expression_p(node)
}

function statement_list(value) {
    if (Array.isArray(value)) {
        return value.reduce((acc,v)=>acc.concat(statement_list(v)), [])
    }
    return [expression_p(value) ? mknode('ExpressionStatement', {node: value, expression: value}) : value]
}

function wrap_last(seq, fn) {
    if (seq.length == 0) {
        return seq
    }
    const xs = seq.slice(0, -1);
    const [x] = seq.slice(-1);
    return xs.concat([fn(x)])
}

const kw_start = keyword("start");
const kw_end = keyword("end");
const kw_line = keyword("line");
const kw_col = keyword("col");
const kw_file = keyword("file");

function mknode(type, {node, end_node, ...props}) {
    const out = {type: type, ...props};
    // TODO: adding these locations incurs a significant cost, and is really
    // only useful for source mapping. We should disable this if source mapping
    // is off. Also see: mksym
    const m = meta(node);
    if (m) {
        const start = Lookup._get(m, kw_start);
        const end = Lookup._get(m, kw_end);
        const line = Lookup._get(m, kw_line);
        const col = Lookup._get(m, kw_col);
        if (start) out.start = start;
        if (end) out.end = end;
        if (line) out.line = line;
        if (col) out.col = col;
    }
    if (out.start) {
        out.loc = {start: {line: out.line, column: out.col}};
    }
    return out
}

const NULL_NODE = mknode('Literal', {value: null, raw: 'null'});

function mksym(node, n) {
    const s = symbol(null, null, n);
    s.start = node.start;
    s.end = node.end;
    s.end = node.end;
    s.line = node.line;
    s.col = node.col;
    return s
}


class CodeGen {
    constructor() {
    }

    emit(node, value) {
        try {
            assert(arguments.length == 2, "Emit takes a node and a value");
            if (value === null) {
                return NULL_NODE
            }
            if(Array.isArray(value)) {
                return this.array_literal(node, value.map((e)=>this.emit(node, e)))
                // return this.wrap_set_meta(
                //     this.array_literal(node, value.map((e)=>this.emit(node, e))),
                //     meta(value)
                // )
            }
            if((typeof value === 'object' || typeof value === 'function') && (typeof (value?.emit) === "function")) {
                return value.emit(this)
            }
            if (value instanceof RegExp) {
                return mknode("Literal", {node: value, value: {}, raw: value.toString(), regex: {pattern: value.source, modifiers: value.modifiers}})
            }
            if(typeof value === 'object') {
                return this.object_literal(node, Object.entries(value).map(([k,v])=>[this.emit(node, k), this.emit(node, v)]))
            }
            // if(value === undefined) {
            //     console.error("NODE", node)
            //     throw new Error(`Can't emit undefined`)
            // }
            return this.literal(node, value)
        } catch (e) {
            if (!e.message.startsWith("Piglet compilation failed")) {
                const m = meta(node);
                e.message = `Piglet compilation failed at\n  ${Lookup._get(m, kw_file)}:${Lookup._get(m, kw_line)}:${Lookup._get(m, kw_col)}\n  ${print_str(node.form)}\n\n${e.message}`;
            }
            throw e
        }
    }

    emit_expr(node, value) {
        return this.as_expression(this.emit(node, value))
    }

    current_module() {
        return resolve(symbol("piglet:lang:*current-module*")).deref()
    }

    as_expression(node) {
        if (Array.isArray(node)) {
            if (node.find(Array.isArray)) {
                node = node.flat();
            }
            if (node.length == 0) {
                return NULL_NODE
            }
            if (node.length == 1) {
                return this.as_expression(node[0])
            }
            if (expression_p(node.slice(-1)[0])) {
                return this.wrap_iife(node[0], node)
            } else {
                return this.wrap_iife(node[0], node.concat([NULL_NODE]))
            }
        }
        if (expression_p(node)) {
            return node
        }
        if (node.type === 'ExpressionStatement') {
            return node.expression
        }
        return this.wrap_iife(node, [node, NULL_NODE])
    }

    as_statement(node) {
        if (Array.isArray(node)) {
            if (node.find(Array.isArray)) {
                node = node.flat();
            }
            if (node.length == 0) {
                return mknode('EmptyStatement', {})
            }
            if (node.length == 1) {
                return this.as_statement(node[0])
            }
            return this.block_stmt(node[0], node)
        }
        if (!expression_p(node)) {
            return node
        }
        return this.expr_stmt(node, node)
    }

    return_stmt(node, expression) {
        return mknode('ReturnStatement',
                      {node: node,
                       argument: this.as_expression(expression)})
    }

    function_body(node, body) {
        return this.block_stmt(
            node,
            wrap_last(statement_list(body), (e)=>(statement_p(e) ? e : this.return_stmt(e, e))))
    }

    wrap_set_meta(node, meta) {
        if (meta) {
            return this.invoke_var(
                node,
                'piglet',
                'lang',
                'set-meta!',
                [node, this.emit(meta, meta)])
        }
        return node
    }

    function_expr(node, {name, argv, body, async_p, meta}) {
        return this.wrap_set_meta(
            mknode('FunctionExpression',
                   {node: node,
                    id: name,
                    expression: false,
                    generator: false,
                    params: argv,
                    async: async_p,
                    body: this.function_body(node, body)}),
            meta)
    }

    identifier(node, name) {
        return mknode('Identifier', {node: node, name: name})
    }

    nest_expr(parts, rf) {
        return parts.slice(1).reduce(rf, parts[0])
    }

    infix_op(node, op, args) {
        return args.reduce((acc, arg)=>{
            return mknode('BinaryExpression', {
                node: node,
                end_node: arg,
                left: this.as_expression(acc),
                operator: op,
                right: this.as_expression(arg)
            })
        })
    }

    boolean_infix_op(node, op, args) {
        return partition_n_step(2, 1, args).map(([left, right])=>{
            return mknode('BinaryExpression', {
                node: node,
                end_node: right,
                left: this.as_expression(left),
                operator: op,
                right: this.as_expression(right)
            })
        }).reduce((acc, arg)=>{
            return mknode('BinaryExpression', {
                node: node,
                end_node: arg,
                left: this.as_expression(acc),
                operator: op,
                right: this.as_expression(arg)
            })
        })
    }

    literal(node, value, raw) {
        return mknode('Literal',
                      {node: node,
                       value: value,
                       raw: (raw === undefined && value === undefined ? "undefined" :
                             typeof value === "bigint" ? value.toString() + "n" :
                             JSON.stringify(value))})
    }

    array_literal(node, elements) {
        return mknode('ArrayExpression', {node: node, elements: elements.map((e)=>this.as_expression(e))})
    }

    object_literal(node, kvs) {
        return mknode(
            'ObjectExpression',
            {node: node,
             properties: kvs.map((kv)=>{
                 const [k, v] = kv;
                 return mknode(
                     'Property',
                     {node: node,
                      method: false,
                      shorthand: false,
                      computed: false,
                      kind: "init",
                      key: k,
                      value: v})})})
    }

    member_lookup(node, obj, syms) {
        return syms.reduce((acc,sym)=>{
            return mknode('MemberExpression', {node: sym, object: this.as_expression(acc), property: this.identifier(sym, sym.name), computed: false})
        }, obj)
    }

    oget(node, o, k) {
        return mknode('MemberExpression', {node: node, object: this.as_expression(o), property: k, computed: true})
    }

    var_value(node, sym) {
        return this.member_lookup(node, this.var_ref(node, sym), [symbol('value')])
    }

    var_ref(node, sym) {
        const the_var = resolve(sym);
        if (!the_var) {
            throw(new Error(`Var not found: ${sym.inspect()} in ${this.current_module().inspect()}`))
        }
        assert(the_var.pkg);
        // if (the_var.global_name) {
        //     return mknode('MemberExpression',
        //                   {node: node,
        //                    object: this.identifier(node, global),
        //                    property: this.identifier(node, the_var.global_name),
        //                    computed: false})
        // }
        return this.member_lookup(node,
                                  this.oget(node,
                                            this.identifier(node, "$piglet$"),
                                            this.literal(node, the_var.pkg, `"${the_var.pkg}"`)),
                                  [mksym(node, munge(the_var.module)),
                                   mksym(node, munge(sym.name))])
        // return this.method_call(
        //     node,
        //     "deref",
        //     this.function_call(
        //         node,
        //         this.member_lookup(node, this.identifier(node, "$piglet$"),
        //                            [mksym(node, munge(the_var.pkg)),
        //                             mksym(node, "modules"),
        //                             mksym(node, munge(the_var.module)),
        //                             mksym(node, "resolve")]),
        //         [this.literal(sym, sym.name)]
        //     ),
        //     []
        // )
    }

    call_expr(node, callee, args) {
        return mknode('CallExpression',
                      {node: node,
                       callee: callee,
                       arguments: args})

    }

    dynamic_import(node, path) {
        return this.call_expr(node, this.identifier('import'), [path])
    }

    function_call(node, callee, args) {
        return this.call_expr(node, this.as_expression(callee), args.map((a)=>this.as_expression(a)))
    }

    method_call(node, method, object, args) {
        return this.call_expr(
            node,
            mknode('MemberExpression',
                   {node: node,
                    object: object,
                    property: (typeof method === 'string' ?
                               this.identifier(node, method) :
                               this.identifier(method, method.name)),
                    computed: false}),
            args.map((a)=>this.as_expression(a))
        )
    }

    define_var(node, name, value, meta) {
        return this.function_call(node,
                                  this.var_ref(node, symbol('piglet:lang:intern')),
                                  meta ? [this.emit(node, name), value, meta] : [this.emit(name, name), value])
        // return this.method_call(node,
        //                         "intern",
        //                         this.module_ref(node, this.current_module().pkg, this.current_module().name),
        //                         meta ? [this.literal(name, name.name), value, meta] : [this.literal(name, name.name), value])
    }

    invoke_var(node, pkg, mod, name, args) {
        return this.function_call(
            node,
            this.var_ref(node, symbol(pkg, mod, name)),
            args
        )
    }

    conditional(node, test, if_branch, else_branch) {
        return mknode('ConditionalExpression',
                      {node:node,
                       test: this.as_expression(test),
                       consequent: this.as_expression(if_branch),
                       alternate: this.as_expression(else_branch||NULL_NODE)})

    }

    if_stmt(node, test, if_branch, else_branch) {
        return mknode('IfStatement',
                      {node:node,
                       test: this.as_expression(test),
                       consequent: this.block_stmt(if_branch, if_branch),
                       alternate: this.block_stmt(else_branch, else_branch||NULL_NODE)})

    }

    await_expr(node, arg) {
        return mknode('AwaitExpression', {node:node, argument: arg})
    }

    wrap_iife(node, body) {
        return this.call_expr(
            node,
            this.function_expr(node, {name: null, argv: [], body: body, async_p: false}),
            []
        )
    }

    wrap_async_iife(node, body) {
        return this.call_expr(
            node,
            this.function_expr(node, {name: null, argv: [], body: body, async_p: true}),
            []
        )
    }

    new_expr(node, ctor, args) {
        return mknode('NewExpression', {node: node, callee: ctor, arguments: args})
    }

    rest_element(node, arg) {
        return mknode('RestElement', {node:node, argument: arg})
    }

    block_stmt(node, body) {
        return mknode('BlockStatement', {node:node, body: statement_list(body)})
    }

    expr_stmt(node, expression) {
        return mknode('ExpressionStatement', {node:node, expression: expression})
    }

    assignment(node, left, right) {
        return mknode('AssignmentExpression',
                      {node:node,
                       operator: '=',
                       left: left,
                       right: this.as_expression(right)})

    }

    var_decl(node, kind, identifier, rhs) {
        return mknode('VariableDeclaration',
                      {node: node,
                       kind: kind,
                       declarations: [mknode('VariableDeclarator', {node: node, id: identifier, init: this.as_expression(rhs)})]})
    }

    const_var_decl(node, identifier, rhs) { return this.var_decl(node, 'const', identifier, rhs) }
    let_var_decl(node, identifier, rhs)   { return this.var_decl(node, 'let', identifier, rhs) }

    lhs(node, form) {
        if (Array.isArray(form)) {
            return mknode('ArrayPattern', {node: node,
                                           elements: form.map((e)=>this.lhs(node, e))})
        } else  {
            return this.emit(node, form)
        }
    }

    unary_expression(node, operator, argument, prefix) {
        return mknode('UnaryExpression',
                      {node: node,
                       operator: operator,
                       argument: this.as_expression(argument),
                       prefix: prefix})
    }

    typeof_expression(node, argument) {
        return this.unary_expression(node, "typeof", argument, true)
    }

    throw_stmt(node, argument) {
        return mknode('ThrowStatement', {node:node, argument:argument})
    }

    while_stmt(node, test, body) {
        return mknode('WhileStatement',
                      {node: node,
                       test: test,
                       body: this.block_stmt(body, statement_list(body))})
    }

    catch_clause(catch_form, arg, body) {
        return mknode('CatchClause',
                      {node: catch_form,
                       param: this.emit(arg, arg),
                       body: this.block_stmt(catch_form, statement_list(body.map(f=>this.emit(f, f))))})
    }

    try_stmt(form, body,
             catch_form, catch_arg, catch_body,
             finalizer_form, finalizer_body) {
        return mknode('TryStatement',
                      {node: form,
                       block: this.block_stmt(form, statement_list(body.map(f=>this.emit(f, f)))),
                       handler: catch_form && this.catch_clause(catch_form, catch_arg, catch_body),
                       finalizer: finalizer_form && this.block_stmt(finalizer_form, statement_list(finalizer_body.map(f=>this.emit(f, f))))})
    }

    break_stmt() { return {type: 'BreakStatement'} }
    continue_stmt() { return {type: 'ContinueStatement'} }
}

// Copyright (c) Arne Brasseur 2023. All rights reserved.


const pkg$name = qname('https://vocab.piglet-lang.org/package/name');
qname('https://vocab.piglet-lang.org/package/deps');
const pkg$location = qname('https://vocab.piglet-lang.org/package/location');
qname('https://vocab.piglet-lang.org/package/location');

class AbstractCompiler {
    constructor(opts) {
        this.opts = opts;
        this.analyzer = new Analyzer();
        this.code_gen = new CodeGen();
        Object.defineProperty(this, 'verbosity', {get: ()=>{
            return ModuleRegistry.instance().find_module("https://piglet-lang.org/packages/piglet", "lang").resolve("*verbosity*").value
        }});
        // const emit = this.code_gen.emit
        // this.code_gen.emit = (n,a)=>{console.log("\nEMITTING"); print_ast(0, n); return emit.call(this.code_gen, n, a)}
    }

    async slurp(path) {
        throw new Error("Not implemented")
    }

    async slurp_mod(pkg, mod) {
        throw new Error("Not implemented")
    }

    estree_to_js(estree) {
        throw new Error("not implemented")
    }

    async require(mod) {
        // console.log(`Compiler::require ${mod.inspect()}`)
        assert_type(mod, QSym);
        const prev_mod = resolve(symbol("piglet", "lang", "*current-module*")).deref();
        mod.prefix ? mod.prefix : prev_mod.pkg;
        mod.suffix;
        if (!ensure_module(mod.pkg, mod.mod)?.required) {
            const loaded = await this.load(mod);
            loaded.required = true;
            return loaded
        }
        return false
    }

    async eval_string(source, filename, start_offset, line_offset) {
        const r = string_reader(source, filename);
        if (start_offset) r.start_offset = start_offset;
        if (line_offset) r.line_offset = line_offset;

        const self = this;
        const read_and_eval = async function () {
            if (!r.eof()) {
                r.data_readers = data_readers.value.toJSON();
                let form = r.read();
                if (form) {
                    let result = await self.eval(form);
                    await read_and_eval();
                    return result
                }
            }
        };
        return await read_and_eval()
    }

    async load_file(path) {
        const prev_mod = resolve(symbol("piglet", "lang", "*current-module*")).deref();
        const source = await this.slurp(path);
        resolve(symbol("piglet", "lang", "*current-location*")).set_value(path);
        await this.eval_string(source.toString(), path);
        resolve(symbol("piglet", "lang", "*current-location*")).set_value(prev_mod.location);
        resolve(symbol("piglet", "lang", "*current-module*")).set_value(prev_mod);
        resolve(symbol("piglet", "lang", "*current-context*")).set_value(prev_mod.context);
    }

    resolve_js_path(path) {
        return path
    }

    set_current_package(pkg) {
        resolve(symbol('piglet:lang:*current-package*')).set_value(module_registry.ensure_package(pkg));
    }

    async load(mod) {
        // console.log(`Loading ${mod.fqn || mod.name}: start`)
        // console.time(`Loading ${mod.fqn || mod.name}`)
        const prev_mod = resolve(symbol("piglet", "lang", "*current-module*")).deref();
        const current_package = resolve(symbol("piglet", "lang", "*current-package*")).deref();
        if(mod instanceof PrefixName) { // legacy
            console.log(`WARN: specifying modules with PrefixNames is deprecated, got ${mod}`,);
            this.set_current_package(mod.prefix ? mod.prefix : prev_mod.pkg);
            this.mod_name = mod.suffix;
        }

        if(mod instanceof Sym) {
            if (mod.mod) {
                this.set_current_package(current_package.resolve_alias(mod.mod));
            }
            this.mod_name = mod.name;
        }

        if(mod instanceof QSym) {
            this.set_current_package(mod.pkg);
            this.mod_name = mod.mod;
        }

        const [source, location] = await this.slurp_mod(resolve(symbol('piglet:lang:*current-package*')).value.name, this.mod_name);
        assert(location, `No location returned for ${mod}`);
        resolve(symbol("piglet", "lang", "*current-location*")).set_value(location);
        await this.eval_string(source.toString(), location);
        // console.log(`Restoring *current-module* to ${prev_mod.inspect()}`)
        resolve(symbol("piglet", "lang", "*current-location*")).set_value(prev_mod.location);
        mod = resolve(symbol("piglet", "lang", "*current-module*")).deref();
        resolve(symbol("piglet", "lang", "*current-module*")).set_value(prev_mod);
        resolve(symbol("piglet", "lang", "*current-context*")).set_value(prev_mod.context);
        resolve(symbol("piglet", "lang", "*current-package*")).set_value(current_package);
        // console.timeEnd(`Loading ${mod.fqn || mod.name}`)
        return mod
    }

    async register_package(location_href, pkg_spec) {
        pkg_spec = assoc(pkg_spec, pkg$name, pkg_spec.get(pkg$name, location_href && location_href.replace("/package.pig", "")));
        pkg_spec = assoc(pkg_spec, pkg$location, location_href);

        pkg_spec.get(pkg$name);
        const pkg = module_registry.package_from_spec(pkg_spec);
        for (const [alias, dep_spec] of Array.from(pkg.deps)) {
            const loc = dep_spec.get(pkg$location);
            const dep_pkg = await this.load_package(loc);
            pkg.add_alias(alias.toString(), dep_pkg.name.toString());
        }
        return pkg
    }

    async eval(form) {
        if (this.verbosity >= 2) {
            println("--- form ------------");
            println(form);
        }
        const ast = this.analyzer.analyze(form);
        if (this.verbosity >= 3) {
            println("--- AST -------------");
            console.dir(ast, {depth: null});
        }
        let estree = ast.emit(this.code_gen);
        if (this.verbosity >= 4) {
            println("--- estree ----------");
            console.dir(estree, {depth: null});
        }
        if (this.writer) {
            this.writer.write(
                this.estree_to_js(
                    Array.isArray(estree) ?
                        {type: 'Program', body: estree} :
                        estree));
        }
        estree = this.code_gen.wrap_async_iife(ast, estree);
        if (this.verbosity >= 5) {
            println("--- WRAPPED estree ----------");
            console.dir(estree, { depth: null });
        }
        let js = this.estree_to_js(estree);
        if (this.verbosity >= 1) {
            println("--- js --------------");
            println(js);
        }
        return await eval(js)
    }
}

// import {stdout} from 'node:process'
// const write = (s)=>stdout.write(s)

// function print_ast(depth, ast) {
//     const indent = (d)=>{for (let i =0 ; i < (d||depth);i++) { stdout.write(' ')}}
//     if (ast && ast?.inspect) {
//         write(ast.inspect())
//     } else if (Array.isArray(ast)) {
//         write("[\n")
//         for (let el of ast) {
//             indent(depth+2)
//             print_ast(depth+2, el)
//             write(",\n")
//         }
//         indent()
//         write("]")
//     } else if (ast && (typeof ast == 'object')) {
//         let type = ast?.constructor?.name
//         if(type) write(`${type} `)
//         write("{\n")
//         for (let [k, v] of ast instanceof Map ? ast.entries() : Object.entries(ast)) {
//             if (k === 'form' && Object.keys(ast).length != 1) {continue}
//             indent(depth+2)
//             write(k.toString())
//             write(': ')
//             if (v && v?.inspect) {
//                 write(v.inspect())
//                 write(",")
//                 write("\n")
//             } else if (v && (Array.isArray(v) || (typeof v == 'object'))) {
//                 print_ast(depth+2, v)
//                 write(",")
//                 write("\n")
//             } else {
//                 write('#js ')
//                 write(JSON.stringify(v)||`${ast}`)
//                 write(",\n")
//             }
//         }
//         indent()
//         write('}')
//     } else {
//         write('#js ')
//         write(JSON.stringify(ast)||`${ast}`)
//     }
// }

// Copyright (c) Arne Brasseur 2023. All rights reserved.


class BrowserCompiler extends AbstractCompiler {
    async slurp(path) {
        const response = await fetch(path);
        return await response.text()
    }

    async slurp_mod(pkg_name, mod_name) {
        const pkg = module_registry.find_package(pkg_name);
        for (const dir of pkg.paths) {
            const location = new URL(`${mod_name}.pig`, new URL(`${dir}/`, new URL(pkg.location, window.location))).href;
            const response = await fetch(location);
            if (response.ok) return [await response.text(), location]
        }
    }

    resolve_js_path(js_path) {
        const mod = deref(resolve(symbol("piglet:lang:*current-module*")));

        if (js_path.startsWith("./") || js_path.startsWith("../") || js_path.startsWith("/")) {
            return new URL(js_path, mod.location).href
        }
        return js_path
    }

    estree_to_js(estree) {
        if (window.sourceMap) {
            const mod = deref(resolve(symbol("piglet:lang:*current-module*")));
            if (mod.location) {
                try {
                    const map = new sourceMap.SourceMapGenerator({
                        file: mod.location, skipValidation: true
                    });
                    const code = astring.generate(estree, {sourceMap: map});
                    return `${code}\n//# sourceURL=${mod.location}?line=${estree.line}\n//# sourceMappingURL=data:application/json;base64,${btoa(map.toString())}`
                } catch (e) {
                    console.error("ERROR: astring failed on input", estree);
                    throw(e)
                }
            } else {
                console.warn(`WARN: ${mod.inspect()} misses location, no source map generated.`);
            }
        }
        return astring.generate(estree)
    }

    async load_package(location) {
        assert(location);
        const package_pig_loc = new URL("package.pig", new URL(`${location}/`, window.location)).href;
        const response = await fetch(package_pig_loc);
        if (response.ok) {
            let package_pig = expand_qnames(read_string(await response.text()));
            return this.register_package(package_pig_loc, package_pig)
        }
    }

}

// Copyright (c) Arne Brasseur 2023. All rights reserved.

window.$piglet$ = module_registry.index;

const verbosity_str = new URL(import.meta.url).searchParams.get("verbosity");

const compiler = new BrowserCompiler({verbosity: verbosity_str ? parseInt(verbosity_str, 10) : 0});
intern(symbol("piglet:lang:*compiler*"), compiler);

// await compiler.load_package(new URL("../../../packages/piglet", import.meta.url))
await compiler.load_package(new URL("https://cdn.jsdelivr.net/npm/piglet-lang@0.1.29/packages/piglet", import.meta.url));


compiler.load(symbol("piglet:lang")).then(()=>{
    for (const script of document.getElementsByTagName("script")) {
        if(script.type == 'application/piglet' || script.type == 'piglet') {
            if (script.src) {
                compiler.load_file(script.src);
            } else {
                compiler.eval_string(script.innerText);
            }
        }
    }
});
