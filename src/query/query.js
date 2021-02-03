import Transformable from '../table/transformable';
import { Query as QueryType } from './constants';
import { Verb, Verbs } from './verb';

/**
 * Create a new query instance. The query interface provides
 * a table-like verb API to construct a query that can be
 * serialized or evaluated against Arquero tables.
 * @param {string} [tableName] The name of the table to query. If
 *  provided, will be used as the default input table to pull from
 *  a provided catalog to run the query against.
 * @return {Query} A new builder instance.
 */
export function query(tableName) {
  return new Query(null, null, tableName);
}

/**
 * Create a new query instance from a serialized object.
 * @param {object} object A serialized query representation, such as
 *  those generated by query(...).toObject().
 * @returns {Query} The instantiated query instance.
 */
export function queryFrom(object) {
  return Query.from(object);
}

/**
 * Model a query as a collection of serializble verbs.
 * Provides a table-like interface for constructing queries.
 */
export default class Query extends Transformable {

  /**
   * Construct a new query instance.
   * @param {Verb[]} verbs An array of verb instances.
   * @param {object} [params] Optional query parameters, corresponding
   *  to parameter references in table expressions.
   * @param {string} [table] Optional name of the table to query.
   */
  constructor(verbs, params, table) {
    super(params);
    this._verbs = verbs || [];
    this._table = table;
  }

  /**
   * Create a new query instance from the given serialized object.
   * @param {object} object A serialized query representation, such as
   *  those generated by Query.toObject.
   * @returns {Query} The instantiated query.
   */
  static from({ verbs, table, params }) {
    return new Query(verbs.map(Verb.from), params, table);
  }

  /**
   * Provide an informative object string tag.
   */
  get [Symbol.toStringTag]() {
    if (!this._verbs) return 'Object'; // bail if called on prototype
    const ns = this._verbs.length;
    return `Query: ${ns} verbs` + (this._table ? ` on '${this._table}'` : '');
  }

  /**
   * Return the number of verbs in this query.
   */
  get length() {
    return this._verbs.length;
  }

  /**
   * Return the name of the table this query applies to.
   * @return {string} The name of the source table, or undefined.
   */
  get tableName() {
    return this._table;
  }

  /**
   * Get or set table expression parameter values.
   * If called with no arguments, returns the current parameter values
   * as an object. Otherwise, adds the provided parameters to this
   * query's parameter set and returns the table. Any prior parameters
   * with names matching the input parameters are overridden.
   * @param {object} values The parameter values.
   * @return {Query|object} The current parameter values (if called
   *  with no arguments) or this query.
   */
  params(values) {
    if (arguments.length) {
      this._params = { ...this._params, ...values };
      return this;
    } else {
      return this._params;
    }
  }

  /**
   * Evaluate this query against a given table and catalog.
   * @param {Table} table The Arquero table to process.
   * @param {Function} catalog A table lookup function that accepts a table
   *  name string as input and returns a corresponding Arquero table.
   * @returns {Table} The resulting Arquero table.
   */
  evaluate(table, catalog) {
    table = table || catalog(this._table);
    for (const verb of this._verbs) {
      table = verb.evaluate(table.params(this._params), catalog);
    }
    return table;
  }

  /**
   * Serialize this query as a JSON-compatible object. The resulting
   * object can be passed to Query.from to re-instantiate this query.
   * @returns {object} A JSON-compatible object representing this query.
   */
  toObject() {
    return serialize(this, 'toObject');
  }

  /**
   * Serialize this query as a JSON-compatible object. The resulting
   * object can be passed to Query.from to re-instantiate this query.
   * This method simply returns the result of toObject, but is provided
   * as a separate method to allow later customization of JSON export.
   * @returns {object} A JSON-compatible object representing this query.
   */
  toJSON() {
    return this.toObject();
  }

  /**
   * Serialize this query to a JSON-compatible abstract syntax tree.
   * All table expressions will be parsed and represented as AST instances
   * using a modified form of the Mozilla JavaScript AST format.
   * This method can be used to output parsed and serialized representations
   * to translate Arquero queries to alternative data processing platforms.
   * @returns {object} A JSON-compatible abstract syntax tree object.
   */
  toAST() {
    return serialize(this, 'toAST', { type: QueryType });
  }
}

function serialize(query, method, props) {
  return {
    ...props,
    verbs: query._verbs.map(verb => verb[method]()),
    ...(query._params ? { params: query._params } : null),
    ...(query._table ? { table: query._table } : null)
  };
}

function append(qb, verb) {
  return new Query(
    qb._verbs.concat(verb),
    qb._params,
    qb._table
  );
}

export function addQueryVerb(name, verb) {
  Query.prototype[name] = function(...args) {
    return append(this, verb(...args));
  };
}

// Internal verb handlers
for (const name in Verbs) {
  const verb = Verbs[name];
  Query.prototype['__' + name] = function(qb, ...args) {
    return append(qb, verb(...args));
  };
}