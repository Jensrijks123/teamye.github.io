function toArray(objectOrArray) {
  objectOrArray = objectOrArray || [];
  return Array.isArray(objectOrArray) ? objectOrArray : [objectOrArray];
}

function log(msg) {
  return `[Vaadin.Router] ${msg}`;
}

function logValue(value) {
  if (typeof value !== 'object') {
    return String(value);
  }

  const stringType = Object.prototype.toString.call(value).match(/ (.*)\]$/)[1];
  if (stringType === 'Object' || stringType === 'Array') {
    return `${stringType} ${JSON.stringify(value)}`;
  } else {
    return stringType;
  }
}

const MODULE = 'module';
const NOMODULE = 'nomodule';
const bundleKeys = [MODULE, NOMODULE];

function ensureBundle(src) {
  if (!src.match(/.+\.[m]?js$/)) {
    throw new Error(
      log(`Unsupported type for bundle "${src}": .js or .mjs expected.`)
    );
  }
}

function ensureRoute(route) {
  if (!route || !isString(route.path)) {
    throw new Error(
      log(`Expected route config to be an object with a "path" string property, or an array of such objects`)
    );
  }

  const bundle = route.bundle;

  const stringKeys = ['component', 'redirect', 'bundle'];
  if (
    !isFunction(route.action) &&
    !Array.isArray(route.children) &&
    !isFunction(route.children) &&
    !isObject(bundle) &&
    !stringKeys.some(key => isString(route[key]))
  ) {
    throw new Error(
      log(
        `Expected route config "${route.path}" to include either "${stringKeys.join('", "')}" ` +
        `or "action" function but none found.`
      )
    );
  }

  if (bundle) {
    if (isString(bundle)) {
      ensureBundle(bundle);
    } else if (!bundleKeys.some(key => key in bundle)) {
      throw new Error(
        log('Expected route bundle to include either "' + NOMODULE + '" or "' + MODULE + '" keys, or both')
      );
    } else {
      bundleKeys.forEach(key => key in bundle && ensureBundle(bundle[key]));
    }
  }

  if (route.redirect) {
    ['bundle', 'component'].forEach(overriddenProp => {
      if (overriddenProp in route) {
        console.warn(
          log(
            `Route config "${route.path}" has both "redirect" and "${overriddenProp}" properties, ` +
            `and "redirect" will always override the latter. Did you mean to only use "${overriddenProp}"?`
          )
        );
      }
    });
  }
}

function ensureRoutes(routes) {
  toArray(routes).forEach(route => ensureRoute(route));
}

function loadScript(src, key) {
  let script = document.head.querySelector('script[src="' + src + '"][async]');
  if (!script) {
    script = document.createElement('script');
    script.setAttribute('src', src);
    if (key === MODULE) {
      script.setAttribute('type', MODULE);
    } else if (key === NOMODULE) {
      script.setAttribute(NOMODULE, '');
    }
    script.async = true;
  }
  return new Promise((resolve, reject) => {
    script.onreadystatechange = script.onload = e => {
      script.__dynamicImportLoaded = true;
      resolve(e);
    };
    script.onerror = e => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      reject(e);
    };
    if (script.parentNode === null) {
      document.head.appendChild(script);
    } else if (script.__dynamicImportLoaded) {
      resolve();
    }
  });
}

function loadBundle(bundle) {
  if (isString(bundle)) {
    return loadScript(bundle);
  } else {
    return Promise.race(
      bundleKeys
        .filter(key => key in bundle)
        .map(key => loadScript(bundle[key], key))
    );
  }
}

function fireRouterEvent(type, detail) {
  return !window.dispatchEvent(new CustomEvent(
    `vaadin-router-${type}`,
    {cancelable: type === 'go', detail}
  ));
}

function isObject(o) {
  // guard against null passing the typeof check
  return typeof o === 'object' && !!o;
}

function isFunction(f) {
  return typeof f === 'function';
}

function isString(s) {
  return typeof s === 'string';
}

function getNotFoundError(context) {
  const error = new Error(log(`Page not found (${context.pathname})`));
  error.context = context;
  error.code = 404;
  return error;
}

const notFoundResult = new (class NotFoundResult {})();

/* istanbul ignore next: coverage is calculated in Chrome, this code is for IE */
function getAnchorOrigin(anchor) {
  // IE11: on HTTP and HTTPS the default port is not included into
  // window.location.origin, so won't include it here either.
  const port = anchor.port;
  const protocol = anchor.protocol;
  const defaultHttp = protocol === 'http:' && port === '80';
  const defaultHttps = protocol === 'https:' && port === '443';
  const host = (defaultHttp || defaultHttps)
    ? anchor.hostname // does not include the port number (e.g. www.example.org)
    : anchor.host; // does include the port number (e.g. www.example.org:80)
  return `${protocol}//${host}`;
}

// The list of checks is not complete:
//  - SVG support is missing
//  - the 'rel' attribute is not considered
function vaadinRouterGlobalClickHandler(event) {
  // ignore the click if the default action is prevented
  if (event.defaultPrevented) {
    return;
  }

  // ignore the click if not with the primary mouse button
  if (event.button !== 0) {
    return;
  }

  // ignore the click if a modifier key is pressed
  if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
    return;
  }

  // find the <a> element that the click is at (or within)
  let anchor = event.target;
  const path = event.composedPath
    ? event.composedPath()
    : (event.path || []);

  // FIXME(web-padawan): `Symbol.iterator` used by webcomponentsjs is broken for arrays
  // example to check: `for...of` loop here throws the "Not yet implemented" error
  for (let i = 0; i < path.length; i++) {
    const target = path[i];
    if (target.nodeName && target.nodeName.toLowerCase() === 'a') {
      anchor = target;
      break;
    }
  }

  while (anchor && anchor.nodeName.toLowerCase() !== 'a') {
    anchor = anchor.parentNode;
  }

  // ignore the click if not at an <a> element
  if (!anchor || anchor.nodeName.toLowerCase() !== 'a') {
    return;
  }

  // ignore the click if the <a> element has a non-default target
  if (anchor.target && anchor.target.toLowerCase() !== '_self') {
    return;
  }

  // ignore the click if the <a> element has the 'download' attribute
  if (anchor.hasAttribute('download')) {
    return;
  }

  // ignore the click if the <a> element has the 'router-ignore' attribute
  if (anchor.hasAttribute('router-ignore')) {
    return;
  }

  // ignore the click if the target URL is a fragment on the current page
  if (anchor.pathname === window.location.pathname && anchor.hash !== '') {
    return;
  }

  // ignore the click if the target is external to the app
  // In IE11 HTMLAnchorElement does not have the `origin` property
  const origin = anchor.origin || getAnchorOrigin(anchor);
  if (origin !== window.location.origin) {
    return;
  }

  // if none of the above, convert the click into a navigation event
  const {pathname, search, hash} = anchor;
  if (fireRouterEvent('go', {pathname, search, hash})) {
    event.preventDefault();
    // for a click event, the scroll is reset to the top position.
    if (event && event.type === 'click') {
      window.scrollTo(0, 0);
    }
  }
}

/**
 * A navigation trigger for Vaadin Router that translated clicks on `<a>` links
 * into Vaadin Router navigation events.
 *
 * Only regular clicks on in-app links are translated (primary mouse button, no
 * modifier keys, the target href is within the app's URL space).
 *
 * @memberOf Router.NavigationTrigger
 * @type {NavigationTrigger}
 */
const CLICK = {
  activate() {
    window.document.addEventListener('click', vaadinRouterGlobalClickHandler);
  },

  inactivate() {
    window.document.removeEventListener('click', vaadinRouterGlobalClickHandler);
  }
};

// PopStateEvent constructor shim
const isIE = /Trident/.test(navigator.userAgent);

/* istanbul ignore next: coverage is calculated in Chrome, this code is for IE */
if (isIE && !isFunction(window.PopStateEvent)) {
  window.PopStateEvent = function(inType, params) {
    params = params || {};
    var e = document.createEvent('Event');
    e.initEvent(inType, Boolean(params.bubbles), Boolean(params.cancelable));
    e.state = params.state || null;
    return e;
  };
  window.PopStateEvent.prototype = window.Event.prototype;
}

function vaadinRouterGlobalPopstateHandler(event) {
  if (event.state === 'vaadin-router-ignore') {
    return;
  }
  const {pathname, search, hash} = window.location;
  fireRouterEvent('go', {pathname, search, hash});
}

/**
 * A navigation trigger for Vaadin Router that translates popstate events into
 * Vaadin Router navigation events.
 *
 * @memberOf Router.NavigationTrigger
 * @type {NavigationTrigger}
 */
const POPSTATE = {
  activate() {
    window.addEventListener('popstate', vaadinRouterGlobalPopstateHandler);
  },

  inactivate() {
    window.removeEventListener('popstate', vaadinRouterGlobalPopstateHandler);
  }
};

/**
 * Expose `pathToRegexp`.
 */
var pathToRegexp_1 = pathToRegexp;
var parse_1 = parse;
var compile_1 = compile;
var tokensToFunction_1 = tokensToFunction;
var tokensToRegExp_1 = tokensToRegExp;

/**
 * Default configs.
 */
var DEFAULT_DELIMITER = '/';
var DEFAULT_DELIMITERS = './';

/**
 * The main path matching regexp utility.
 *
 * @type {RegExp}
 */
var PATH_REGEXP = new RegExp([
  // Match escaped characters that would otherwise appear in future matches.
  // This allows the user to escape special characters that won't transform.
  '(\\\\.)',
  // Match Express-style parameters and un-named parameters with a prefix
  // and optional suffixes. Matches appear as:
  //
  // ":test(\\d+)?" => ["test", "\d+", undefined, "?"]
  // "(\\d+)"  => [undefined, undefined, "\d+", undefined]
  '(?:\\:(\\w+)(?:\\(((?:\\\\.|[^\\\\()])+)\\))?|\\(((?:\\\\.|[^\\\\()])+)\\))([+*?])?'
].join('|'), 'g');

/**
 * Parse a string for the raw tokens.
 *
 * @param  {string}  str
 * @param  {Object=} options
 * @return {!Array}
 */
function parse (str, options) {
  var tokens = [];
  var key = 0;
  var index = 0;
  var path = '';
  var defaultDelimiter = (options && options.delimiter) || DEFAULT_DELIMITER;
  var delimiters = (options && options.delimiters) || DEFAULT_DELIMITERS;
  var pathEscaped = false;
  var res;

  while ((res = PATH_REGEXP.exec(str)) !== null) {
    var m = res[0];
    var escaped = res[1];
    var offset = res.index;
    path += str.slice(index, offset);
    index = offset + m.length;

    // Ignore already escaped sequences.
    if (escaped) {
      path += escaped[1];
      pathEscaped = true;
      continue
    }

    var prev = '';
    var next = str[index];
    var name = res[2];
    var capture = res[3];
    var group = res[4];
    var modifier = res[5];

    if (!pathEscaped && path.length) {
      var k = path.length - 1;

      if (delimiters.indexOf(path[k]) > -1) {
        prev = path[k];
        path = path.slice(0, k);
      }
    }

    // Push the current path onto the tokens.
    if (path) {
      tokens.push(path);
      path = '';
      pathEscaped = false;
    }

    var partial = prev !== '' && next !== undefined && next !== prev;
    var repeat = modifier === '+' || modifier === '*';
    var optional = modifier === '?' || modifier === '*';
    var delimiter = prev || defaultDelimiter;
    var pattern = capture || group;

    tokens.push({
      name: name || key++,
      prefix: prev,
      delimiter: delimiter,
      optional: optional,
      repeat: repeat,
      partial: partial,
      pattern: pattern ? escapeGroup(pattern) : '[^' + escapeString(delimiter) + ']+?'
    });
  }

  // Push any remaining characters.
  if (path || index < str.length) {
    tokens.push(path + str.substr(index));
  }

  return tokens
}

/**
 * Compile a string to a template function for the path.
 *
 * @param  {string}             str
 * @param  {Object=}            options
 * @return {!function(Object=, Object=)}
 */
function compile (str, options) {
  return tokensToFunction(parse(str, options))
}

/**
 * Expose a method for transforming tokens into the path function.
 */
function tokensToFunction (tokens) {
  // Compile all the tokens into regexps.
  var matches = new Array(tokens.length);

  // Compile all the patterns before compilation.
  for (var i = 0; i < tokens.length; i++) {
    if (typeof tokens[i] === 'object') {
      matches[i] = new RegExp('^(?:' + tokens[i].pattern + ')$');
    }
  }

  return function (data, options) {
    var path = '';
    var encode = (options && options.encode) || encodeURIComponent;

    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];

      if (typeof token === 'string') {
        path += token;
        continue
      }

      var value = data ? data[token.name] : undefined;
      var segment;

      if (Array.isArray(value)) {
        if (!token.repeat) {
          throw new TypeError('Expected "' + token.name + '" to not repeat, but got array')
        }

        if (value.length === 0) {
          if (token.optional) continue

          throw new TypeError('Expected "' + token.name + '" to not be empty')
        }

        for (var j = 0; j < value.length; j++) {
          segment = encode(value[j], token);

          if (!matches[i].test(segment)) {
            throw new TypeError('Expected all "' + token.name + '" to match "' + token.pattern + '"')
          }

          path += (j === 0 ? token.prefix : token.delimiter) + segment;
        }

        continue
      }

      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        segment = encode(String(value), token);

        if (!matches[i].test(segment)) {
          throw new TypeError('Expected "' + token.name + '" to match "' + token.pattern + '", but got "' + segment + '"')
        }

        path += token.prefix + segment;
        continue
      }

      if (token.optional) {
        // Prepend partial segment prefixes.
        if (token.partial) path += token.prefix;

        continue
      }

      throw new TypeError('Expected "' + token.name + '" to be ' + (token.repeat ? 'an array' : 'a string'))
    }

    return path
  }
}

/**
 * Escape a regular expression string.
 *
 * @param  {string} str
 * @return {string}
 */
function escapeString (str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, '\\$1')
}

/**
 * Escape the capturing group by escaping special characters and meaning.
 *
 * @param  {string} group
 * @return {string}
 */
function escapeGroup (group) {
  return group.replace(/([=!:$/()])/g, '\\$1')
}

/**
 * Get the flags for a regexp from the options.
 *
 * @param  {Object} options
 * @return {string}
 */
function flags (options) {
  return options && options.sensitive ? '' : 'i'
}

/**
 * Pull out keys from a regexp.
 *
 * @param  {!RegExp} path
 * @param  {Array=}  keys
 * @return {!RegExp}
 */
function regexpToRegexp (path, keys) {
  if (!keys) return path

  // Use a negative lookahead to match only capturing groups.
  var groups = path.source.match(/\((?!\?)/g);

  if (groups) {
    for (var i = 0; i < groups.length; i++) {
      keys.push({
        name: i,
        prefix: null,
        delimiter: null,
        optional: false,
        repeat: false,
        partial: false,
        pattern: null
      });
    }
  }

  return path
}

/**
 * Transform an array into a regexp.
 *
 * @param  {!Array}  path
 * @param  {Array=}  keys
 * @param  {Object=} options
 * @return {!RegExp}
 */
function arrayToRegexp (path, keys, options) {
  var parts = [];

  for (var i = 0; i < path.length; i++) {
    parts.push(pathToRegexp(path[i], keys, options).source);
  }

  return new RegExp('(?:' + parts.join('|') + ')', flags(options))
}

/**
 * Create a path regexp from string input.
 *
 * @param  {string}  path
 * @param  {Array=}  keys
 * @param  {Object=} options
 * @return {!RegExp}
 */
function stringToRegexp (path, keys, options) {
  return tokensToRegExp(parse(path, options), keys, options)
}

/**
 * Expose a function for taking tokens and returning a RegExp.
 *
 * @param  {!Array}  tokens
 * @param  {Array=}  keys
 * @param  {Object=} options
 * @return {!RegExp}
 */
function tokensToRegExp (tokens, keys, options) {
  options = options || {};

  var strict = options.strict;
  var start = options.start !== false;
  var end = options.end !== false;
  var delimiter = escapeString(options.delimiter || DEFAULT_DELIMITER);
  var delimiters = options.delimiters || DEFAULT_DELIMITERS;
  var endsWith = [].concat(options.endsWith || []).map(escapeString).concat('$').join('|');
  var route = start ? '^' : '';
  var isEndDelimited = tokens.length === 0;

  // Iterate over the tokens and create our regexp string.
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];

    if (typeof token === 'string') {
      route += escapeString(token);
      isEndDelimited = i === tokens.length - 1 && delimiters.indexOf(token[token.length - 1]) > -1;
    } else {
      var capture = token.repeat
        ? '(?:' + token.pattern + ')(?:' + escapeString(token.delimiter) + '(?:' + token.pattern + '))*'
        : token.pattern;

      if (keys) keys.push(token);

      if (token.optional) {
        if (token.partial) {
          route += escapeString(token.prefix) + '(' + capture + ')?';
        } else {
          route += '(?:' + escapeString(token.prefix) + '(' + capture + '))?';
        }
      } else {
        route += escapeString(token.prefix) + '(' + capture + ')';
      }
    }
  }

  if (end) {
    if (!strict) route += '(?:' + delimiter + ')?';

    route += endsWith === '$' ? '$' : '(?=' + endsWith + ')';
  } else {
    if (!strict) route += '(?:' + delimiter + '(?=' + endsWith + '))?';
    if (!isEndDelimited) route += '(?=' + delimiter + '|' + endsWith + ')';
  }

  return new RegExp(route, flags(options))
}

/**
 * Normalize the given path string, returning a regular expression.
 *
 * An empty array can be passed in for the keys, which will hold the
 * placeholder key descriptions. For example, using `/user/:id`, `keys` will
 * contain `[{ name: 'id', delimiter: '/', optional: false, repeat: false }]`.
 *
 * @param  {(string|RegExp|Array)} path
 * @param  {Array=}                keys
 * @param  {Object=}               options
 * @return {!RegExp}
 */
function pathToRegexp (path, keys, options) {
  if (path instanceof RegExp) {
    return regexpToRegexp(path, keys)
  }

  if (Array.isArray(path)) {
    return arrayToRegexp(/** @type {!Array} */ (path), keys, options)
  }

  return stringToRegexp(/** @type {string} */ (path), keys, options)
}
pathToRegexp_1.parse = parse_1;
pathToRegexp_1.compile = compile_1;
pathToRegexp_1.tokensToFunction = tokensToFunction_1;
pathToRegexp_1.tokensToRegExp = tokensToRegExp_1;

/**
 * Universal Router (https://www.kriasoft.com/universal-router/)
 *
 * Copyright (c) 2015-present Kriasoft.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const {hasOwnProperty} = Object.prototype;
const cache = new Map();
// see https://github.com/pillarjs/path-to-regexp/issues/148
cache.set('|false', {
  keys: [],
  pattern: /(?:)/
});

function decodeParam(val) {
  try {
    return decodeURIComponent(val);
  } catch (err) {
    return val;
  }
}

function matchPath(routepath, path, exact, parentKeys, parentParams) {
  exact = !!exact;
  const cacheKey = `${routepath}|${exact}`;
  let regexp = cache.get(cacheKey);

  if (!regexp) {
    const keys = [];
    regexp = {
      keys,
      pattern: pathToRegexp_1(routepath, keys, {
        end: exact,
        strict: routepath === ''
      }),
    };
    cache.set(cacheKey, regexp);
  }

  const m = regexp.pattern.exec(path);
  if (!m) {
    return null;
  }

  const params = Object.assign({}, parentParams);

  for (let i = 1; i < m.length; i++) {
    const key = regexp.keys[i - 1];
    const prop = key.name;
    const value = m[i];
    if (value !== undefined || !hasOwnProperty.call(params, prop)) {
      if (key.repeat) {
        params[prop] = value ? value.split(key.delimiter).map(decodeParam) : [];
      } else {
        params[prop] = value ? decodeParam(value) : value;
      }
    }
  }

  return {
    path: m[0],
    keys: (parentKeys || []).concat(regexp.keys),
    params,
  };
}

/**
 * Universal Router (https://www.kriasoft.com/universal-router/)
 *
 * Copyright (c) 2015-present Kriasoft.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Traverses the routes tree and matches its nodes to the given pathname from
 * the root down to the leaves. Each match consumes a part of the pathname and
 * the matching process continues for as long as there is a matching child
 * route for the remaining part of the pathname.
 *
 * The returned value is a lazily evaluated iterator.
 *
 * The leading "/" in a route path matters only for the root of the routes
 * tree (or if all parent routes are ""). In all other cases a leading "/" in
 * a child route path has no significance.
 *
 * The trailing "/" in a _route path_ matters only for the leaves of the
 * routes tree. A leaf route with a trailing "/" matches only a pathname that
 * also has a trailing "/".
 *
 * The trailing "/" in a route path does not affect matching of child routes
 * in any way.
 *
 * The trailing "/" in a _pathname_ generally does not matter (except for
 * the case of leaf nodes described above).
 *
 * The "" and "/" routes have special treatment:
 *  1. as a single route
 *     the "" and "/" routes match only the "" and "/" pathnames respectively
 *  2. as a parent in the routes tree
 *     the "" route matches any pathname without consuming any part of it
 *     the "/" route matches any absolute pathname consuming its leading "/"
 *  3. as a leaf in the routes tree
 *     the "" and "/" routes match only if the entire pathname is consumed by
 *         the parent routes chain. In this case "" and "/" are equivalent.
 *  4. several directly nested "" or "/" routes
 *     - directly nested "" or "/" routes are 'squashed' (i.e. nesting two
 *       "/" routes does not require a double "/" in the pathname to match)
 *     - if there are only "" in the parent routes chain, no part of the
 *       pathname is consumed, and the leading "/" in the child routes' paths
 *       remains significant
 *
 * Side effect:
 *   - the routes tree { path: '' } matches only the '' pathname
 *   - the routes tree { path: '', children: [ { path: '' } ] } matches any
 *     pathname (for the tree root)
 *
 * Prefix matching can be enabled also by `children: true`.
 */
function matchRoute(route, pathname, ignoreLeadingSlash, parentKeys, parentParams) {
  let match;
  let childMatches;
  let childIndex = 0;
  let routepath = route.path || '';
  if (routepath.charAt(0) === '/') {
    if (ignoreLeadingSlash) {
      routepath = routepath.substr(1);
    }
    ignoreLeadingSlash = true;
  }

  return {
    next(routeToSkip) {
      if (route === routeToSkip) {
        return {done: true};
      }

      const children = route.__children = route.__children || route.children;

      if (!match) {
        match = matchPath(routepath, pathname, !children, parentKeys, parentParams);

        if (match) {
          return {
            done: false,
            value: {
              route,
              keys: match.keys,
              params: match.params,
              path: match.path
            },
          };
        }
      }

      if (match && children) {
        while (childIndex < children.length) {
          if (!childMatches) {
            const childRoute = children[childIndex];
            childRoute.parent = route;

            let matchedLength = match.path.length;
            if (matchedLength > 0 && pathname.charAt(matchedLength) === '/') {
              matchedLength += 1;
            }

            childMatches = matchRoute(
              childRoute,
              pathname.substr(matchedLength),
              ignoreLeadingSlash,
              match.keys,
              match.params
            );
          }

          const childMatch = childMatches.next(routeToSkip);
          if (!childMatch.done) {
            return {
              done: false,
              value: childMatch.value,
            };
          }

          childMatches = null;
          childIndex++;
        }
      }

      return {done: true};
    },
  };
}

/**
 * Universal Router (https://www.kriasoft.com/universal-router/)
 *
 * Copyright (c) 2015-present Kriasoft.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

function resolveRoute(context) {
  if (isFunction(context.route.action)) {
    return context.route.action(context);
  }
  return undefined;
}

/**
 * Universal Router (https://www.kriasoft.com/universal-router/)
 *
 * Copyright (c) 2015-present Kriasoft.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

function isChildRoute(parentRoute, childRoute) {
  let route = childRoute;
  while (route) {
    route = route.parent;
    if (route === parentRoute) {
      return true;
    }
  }
  return false;
}

function generateErrorMessage(currentContext) {
  let errorMessage = `Path '${currentContext.pathname}' is not properly resolved due to an error.`;
  const routePath = (currentContext.route || {}).path;
  if (routePath) {
    errorMessage += ` Resolution had failed on route: '${routePath}'`;
  }
  return errorMessage;
}

function updateChainForRoute(context, match) {
  const {route, path} = match;

  if (route && !route.__synthetic) {
    const item = {path, route};
    if (!context.chain) {
      context.chain = [];
    } else {
      // Discard old items
      if (route.parent) {
        let i = context.chain.length;
        while (i-- && context.chain[i].route && context.chain[i].route !== route.parent) {
          context.chain.pop();
        }
      }
    }
    context.chain.push(item);
  }
}

/**
 */
class Resolver {
  constructor(routes, options = {}) {
    if (Object(routes) !== routes) {
      throw new TypeError('Invalid routes');
    }

    this.baseUrl = options.baseUrl || '';
    this.errorHandler = options.errorHandler;
    this.resolveRoute = options.resolveRoute || resolveRoute;
    this.context = Object.assign({resolver: this}, options.context);
    this.root = Array.isArray(routes) ? {path: '', __children: routes, parent: null, __synthetic: true} : routes;
    this.root.parent = null;
  }

  /**
   * Returns the current list of routes (as a shallow copy). Adding / removing
   * routes to / from the returned array does not affect the routing config,
   * but modifying the route objects does.
   *
   * @return {!Array<!Router.Route>}
   */
  getRoutes() {
    return [...this.root.__children];
  }

  /**
   * Sets the routing config (replacing the existing one).
   *
   * @param {!Array<!Router.Route>|!Router.Route} routes a single route or an array of those
   *    (the array is shallow copied)
   */
  setRoutes(routes) {
    ensureRoutes(routes);
    const newRoutes = [...toArray(routes)];
    this.root.__children = newRoutes;
  }

  /**
   * Appends one or several routes to the routing config and returns the
   * effective routing config after the operation.
   *
   * @param {!Array<!Router.Route>|!Router.Route} routes a single route or an array of those
   *    (the array is shallow copied)
   * @return {!Array<!Router.Route>}
   * @protected
   */
  addRoutes(routes) {
    ensureRoutes(routes);
    this.root.__children.push(...toArray(routes));
    return this.getRoutes();
  }

  /**
   * Removes all existing routes from the routing config.
   */
  removeRoutes() {
    this.setRoutes([]);
  }

  /**
   * Asynchronously resolves the given pathname, i.e. finds all routes matching
   * the pathname and tries resolving them one after another in the order they
   * are listed in the routes config until the first non-null result.
   *
   * Returns a promise that is fulfilled with the return value of an object that consists of the first
   * route handler result that returns something other than `null` or `undefined` and context used to get this result.
   *
   * If no route handlers return a non-null result, or if no route matches the
   * given pathname the returned promise is rejected with a 'page not found'
   * `Error`.
   *
   * @param {!string|!{pathname: !string}} pathnameOrContext the pathname to
   *    resolve or a context object with a `pathname` property and other
   *    properties to pass to the route resolver functions.
   * @return {!Promise<any>}
   */
  resolve(pathnameOrContext) {
    const context = Object.assign(
      {},
      this.context,
      isString(pathnameOrContext) ? {pathname: pathnameOrContext} : pathnameOrContext
    );
    const match = matchRoute(
      this.root,
      this.__normalizePathname(context.pathname),
      this.baseUrl
    );
    const resolve = this.resolveRoute;
    let matches = null;
    let nextMatches = null;
    let currentContext = context;

    function next(resume, parent = matches.value.route, prevResult) {
      const routeToSkip = prevResult === null && matches.value.route;
      matches = nextMatches || match.next(routeToSkip);
      nextMatches = null;

      if (!resume) {
        if (matches.done || !isChildRoute(parent, matches.value.route)) {
          nextMatches = matches;
          return Promise.resolve(notFoundResult);
        }
      }

      if (matches.done) {
        return Promise.reject(getNotFoundError(context));
      }

      currentContext = Object.assign(
        currentContext
          ? {chain: (currentContext.chain ? currentContext.chain.slice(0) : [])}
          : {},
        context,
        matches.value
      );
      updateChainForRoute(currentContext, matches.value);

      return Promise.resolve(resolve(currentContext)).then(resolution => {
        if (resolution !== null && resolution !== undefined && resolution !== notFoundResult) {
          currentContext.result = resolution.result || resolution;
          return currentContext;
        }
        return next(resume, parent, resolution);
      });
    }

    context.next = next;

    return Promise.resolve()
      .then(() => next(true, this.root))
      .catch((error) => {
        const errorMessage = generateErrorMessage(currentContext);
        if (!error) {
          error = new Error(errorMessage);
        } else {
          console.warn(errorMessage);
        }
        error.context = error.context || currentContext;
        // DOMException has its own code which is read-only
        if (!(error instanceof DOMException)) {
          error.code = error.code || 500;
        }
        if (this.errorHandler) {
          currentContext.result = this.errorHandler(error);
          return currentContext;
        }
        throw error;
      });
  }

  /**
   * URL constructor polyfill hook. Creates and returns an URL instance.
   */
  static __createUrl(url, base) {
    return new URL(url, base);
  }

  /**
   * If the baseUrl property is set, transforms the baseUrl and returns the full
   * actual `base` string for using in the `new URL(path, base);` and for
   * prepernding the paths with. The returned base ends with a trailing slash.
   *
   * Otherwise, returns empty string.
   */
  get __effectiveBaseUrl() {
    return this.baseUrl
      ? this.constructor.__createUrl(
        this.baseUrl,
        document.baseURI || document.URL
      ).href.replace(/[^\/]*$/, '')
      : '';
  }

  /**
   * If the baseUrl is set, matches the pathname with the router’s baseUrl,
   * and returns the local pathname with the baseUrl stripped out.
   *
   * If the pathname does not match the baseUrl, returns undefined.
   *
   * If the `baseUrl` is not set, returns the unmodified pathname argument.
   */
  __normalizePathname(pathname) {
    if (!this.baseUrl) {
      // No base URL, no need to transform the pathname.
      return pathname;
    }

    const base = this.__effectiveBaseUrl;
    const normalizedUrl = this.constructor.__createUrl(pathname, base).href;
    if (normalizedUrl.slice(0, base.length) === base) {
      return normalizedUrl.slice(base.length);
    }
  }
}

Resolver.pathToRegexp = pathToRegexp_1;

/**
 * Universal Router (https://www.kriasoft.com/universal-router/)
 *
 * Copyright (c) 2015-present Kriasoft.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const {pathToRegexp: pathToRegexp$1} = Resolver;
const cache$1 = new Map();

function cacheRoutes(routesByName, route, routes) {
  const name = route.name || route.component;
  if (name) {
    if (routesByName.has(name)) {
      routesByName.get(name).push(route);
    } else {
      routesByName.set(name, [route]);
    }
  }

  if (Array.isArray(routes)) {
    for (let i = 0; i < routes.length; i++) {
      const childRoute = routes[i];
      childRoute.parent = route;
      cacheRoutes(routesByName, childRoute, childRoute.__children || childRoute.children);
    }
  }
}

function getRouteByName(routesByName, routeName) {
  const routes = routesByName.get(routeName);
  if (routes && routes.length > 1) {
    throw new Error(
      `Duplicate route with name "${routeName}".`
      + ` Try seting unique 'name' route properties.`
    );
  }
  return routes && routes[0];
}

function getRoutePath(route) {
  let path = route.path;
  path = Array.isArray(path) ? path[0] : path;
  return path !== undefined ? path : '';
}

function generateUrls(router, options = {}) {
  if (!(router instanceof Resolver)) {
    throw new TypeError('An instance of Resolver is expected');
  }

  const routesByName = new Map();

  return (routeName, params) => {
    let route = getRouteByName(routesByName, routeName);
    if (!route) {
      routesByName.clear(); // clear cache
      cacheRoutes(routesByName, router.root, router.root.__children);

      route = getRouteByName(routesByName, routeName);
      if (!route) {
        throw new Error(`Route "${routeName}" not found`);
      }
    }

    let regexp = cache$1.get(route.fullPath);
    if (!regexp) {
      let fullPath = getRoutePath(route);
      let rt = route.parent;
      while (rt) {
        const path = getRoutePath(rt);
        if (path) {
          fullPath = path.replace(/\/$/, '') + '/' + fullPath.replace(/^\//, '');
        }
        rt = rt.parent;
      }
      const tokens = pathToRegexp$1.parse(fullPath);
      const toPath = pathToRegexp$1.tokensToFunction(tokens);
      const keys = Object.create(null);
      for (let i = 0; i < tokens.length; i++) {
        if (!isString(tokens[i])) {
          keys[tokens[i].name] = true;
        }
      }
      regexp = {toPath, keys};
      cache$1.set(fullPath, regexp);
      route.fullPath = fullPath;
    }

    let url = regexp.toPath(params, options) || '/';

    if (options.stringifyQueryParams && params) {
      const queryParams = {};
      const keys = Object.keys(params);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (!regexp.keys[key]) {
          queryParams[key] = params[key];
        }
      }
      const query = options.stringifyQueryParams(queryParams);
      if (query) {
        url += query.charAt(0) === '?' ? query : `?${query}`;
      }
    }

    return url;
  };
}

/**
 * @typedef NavigationTrigger
 * @type {object}
 * @property {function()} activate
 * @property {function()} inactivate
 */

/** @type {Array<NavigationTrigger>} */
let triggers = [];

function setNavigationTriggers(newTriggers) {
  triggers.forEach(trigger => trigger.inactivate());

  newTriggers.forEach(trigger => trigger.activate());

  triggers = newTriggers;
}

const willAnimate = elem => {
  const name = getComputedStyle(elem).getPropertyValue('animation-name');
  return name && name !== 'none';
};

const waitForAnimation = (elem, cb) => {
  const listener = () => {
    elem.removeEventListener('animationend', listener);
    cb();
  };
  elem.addEventListener('animationend', listener);
};

function animate(elem, className) {
  elem.classList.add(className);

  return new Promise(resolve => {
    if (willAnimate(elem)) {
      const rect = elem.getBoundingClientRect();
      const size = `height: ${rect.bottom - rect.top}px; width: ${rect.right - rect.left}px`;
      elem.setAttribute('style', `position: absolute; ${size}`);
      waitForAnimation(elem, () => {
        elem.classList.remove(className);
        elem.removeAttribute('style');
        resolve();
      });
    } else {
      elem.classList.remove(className);
      resolve();
    }
  });
}

const MAX_REDIRECT_COUNT = 256;

function isResultNotEmpty(result) {
  return result !== null && result !== undefined;
}

function copyContextWithoutNext(context) {
  const copy = Object.assign({}, context);
  delete copy.next;
  return copy;
}

function createLocation({pathname = '', search = '', hash = '', chain = [], params = {}, redirectFrom, resolver}, route) {
  const routes = chain.map(item => item.route);
  return {
    baseUrl: resolver && resolver.baseUrl || '',
    pathname,
    search,
    hash,
    routes,
    route: route || routes.length && routes[routes.length - 1] || null,
    params,
    redirectFrom,
    getUrl: (userParams = {}) => getPathnameForRouter(
      Router.pathToRegexp.compile(
        getMatchedPath(routes)
      )(Object.assign({}, params, userParams)),
      resolver
    )
  };
}

function createRedirect(context, pathname) {
  const params = Object.assign({}, context.params);
  return {
    redirect: {
      pathname,
      from: context.pathname,
      params
    }
  };
}

function renderElement(context, element) {
  element.location = createLocation(context);
  const index = context.chain.map(item => item.route).indexOf(context.route);
  context.chain[index].element = element;
  return element;
}

function runCallbackIfPossible(callback, args, thisArg) {
  if (isFunction(callback)) {
    return callback.apply(thisArg, args);
  }
}

function amend(amendmentFunction, args, element) {
  return amendmentResult => {
    if (amendmentResult && (amendmentResult.cancel || amendmentResult.redirect)) {
      return amendmentResult;
    }

    if (element) {
      return runCallbackIfPossible(element[amendmentFunction], args, element);
    }
  };
}

function processNewChildren(newChildren, route) {
  if (!Array.isArray(newChildren) && !isObject(newChildren)) {
    throw new Error(
      log(
        `Incorrect "children" value for the route ${route.path}: expected array or object, but got ${newChildren}`
      )
    );
  }

  route.__children = [];
  const childRoutes = toArray(newChildren);
  for (let i = 0; i < childRoutes.length; i++) {
    ensureRoute(childRoutes[i]);
    route.__children.push(childRoutes[i]);
  }
}

function removeDomNodes(nodes) {
  if (nodes && nodes.length) {
    const parent = nodes[0].parentNode;
    for (let i = 0; i < nodes.length; i++) {
      parent.removeChild(nodes[i]);
    }
  }
}

function getPathnameForRouter(pathname, router) {
  const base = router.__effectiveBaseUrl;
  return base
    ? router.constructor.__createUrl(pathname.replace(/^\//, ''), base).pathname
    : pathname;
}

function getMatchedPath(chain) {
  return chain.map(item => item.path).reduce((a, b) => {
    if (b.length) {
      return a.replace(/\/$/, '') + '/' + b.replace(/^\//, '');
    }
    return a;
  }, '');
}

/**
 * A simple client-side router for single-page applications. It uses
 * express-style middleware and has a first-class support for Web Components and
 * lazy-loading. Works great in Polymer and non-Polymer apps.
 *
 * Use `new Router(outlet, options)` to create a new Router instance.
 *
 * * The `outlet` parameter is a reference to the DOM node to render
 *   the content into.
 *
 * * The `options` parameter is an optional object with options. The following
 *   keys are supported:
 *   * `baseUrl` — the initial value for [
 *     the `baseUrl` property
 *   ](#/classes/Router#property-baseUrl)
 *
 * The Router instance is automatically subscribed to navigation events
 * on `window`.
 *
 * See [Live Examples](#/classes/Router/demos/demo/index.html) for the detailed usage demo and code snippets.
 *
 * See also detailed API docs for the following methods, for the advanced usage:
 *
 * * [setOutlet](#/classes/Router#method-setOutlet) – should be used to configure the outlet.
 * * [setTriggers](#/classes/Router#method-setTriggers) – should be used to configure the navigation events.
 * * [setRoutes](#/classes/Router#method-setRoutes) – should be used to configure the routes.
 *
 * Only `setRoutes` has to be called manually, others are automatically invoked when creating a new instance.
 *
 * @extends Resolver
 * @demo demo/index.html
 * @summary JavaScript class that renders different DOM content depending on
 *    a given path. It can re-render when triggered or automatically on
 *    'popstate' and / or 'click' events.
 */
class Router extends Resolver {

  /**
   * Creates a new Router instance with a given outlet, and
   * automatically subscribes it to navigation events on the `window`.
   * Using a constructor argument or a setter for outlet is equivalent:
   *
   * ```
   * const router = new Router();
   * router.setOutlet(outlet);
   * ```
   * @param {?Node=} outlet
   * @param {?RouterOptions=} options
   */
  constructor(outlet, options) {
    const baseElement = document.head.querySelector('base');
    const baseHref = baseElement && baseElement.getAttribute('href');
    super([], Object.assign({
      // Default options
      baseUrl: baseHref && Resolver.__createUrl(baseHref, document.URL).pathname.replace(/[^\/]*$/, '')
    }, options));

    this.resolveRoute = context => this.__resolveRoute(context);

    const triggers = Router.NavigationTrigger;
    Router.setTriggers.apply(Router, Object.keys(triggers).map(key => triggers[key]));

    /**
     * The base URL for all routes in the router instance. By default,
     * if the base element exists in the `<head>`, vaadin-router
     * takes the `<base href>` attribute value, resolves against current `document.URL`
     * and gets the `pathname` from the result.
     *
     * @public
     * @type {string}
     */
    this.baseUrl;

    /**
     * A promise that is settled after the current render cycle completes. If
     * there is no render cycle in progress the promise is immediately settled
     * with the last render cycle result.
     *
     * @public
     * @type {!Promise<!RouterLocation>}
     */
    this.ready;
    this.ready = Promise.resolve(outlet);

    /**
     * Contains read-only information about the current router location:
     * pathname, active routes, parameters. See the
     * [Location type declaration](#/classes/RouterLocation)
     * for more details.
     *
     * @public
     * @type {!RouterLocation}
     */
    this.location;
    this.location = createLocation({resolver: this});

    this.__lastStartedRenderId = 0;
    this.__navigationEventHandler = this.__onNavigationEvent.bind(this);
    this.setOutlet(outlet);
    this.subscribe();
    // Using WeakMap instead of WeakSet because WeakSet is not supported by IE11
    this.__createdByRouter = new WeakMap();
    this.__addedByRouter = new WeakMap();
  }

  __resolveRoute(context) {
    const route = context.route;

    let callbacks = Promise.resolve();

    if (isFunction(route.children)) {
      callbacks = callbacks
        .then(() => route.children(copyContextWithoutNext(context)))
        .then(children => {
          // The route.children() callback might have re-written the
          // route.children property instead of returning a value
          if (!isResultNotEmpty(children) && !isFunction(route.children)) {
            children = route.children;
          }
          processNewChildren(children, route);
        });
    }

    const commands = {
      redirect: path => createRedirect(context, path),
      component: (component) => {
        const element = document.createElement(component);
        this.__createdByRouter.set(element, true);
        return element;
      }
    };

    return callbacks
      .then(() => {
        if (this.__isLatestRender(context)) {
          return runCallbackIfPossible(route.action, [context, commands], route);
        }
      })
      .then(result => {
        if (isResultNotEmpty(result)) {
          // Actions like `() => import('my-view.js')` are not expected to
          // end the resolution, despite the result is not empty. Checking
          // the result with a whitelist of values that end the resolution.
          if (result instanceof HTMLElement ||
              result.redirect ||
              result === notFoundResult) {
            return result;
          }
        }

        if (isString(route.redirect)) {
          return commands.redirect(route.redirect);
        }

        if (route.bundle) {
          return loadBundle(route.bundle)
            .then(() => {}, () => {
              throw new Error(log(`Bundle not found: ${route.bundle}. Check if the file name is correct`));
            });
        }
      })
      .then(result => {
        if (isResultNotEmpty(result)) {
          return result;
        }
        if (isString(route.component)) {
          return commands.component(route.component);
        }
      });
  }

  /**
   * Sets the router outlet (the DOM node where the content for the current
   * route is inserted). Any content pre-existing in the router outlet is
   * removed at the end of each render pass.
   *
   * NOTE: this method is automatically invoked first time when creating a new Router instance.
   *
   * @param {?Node} outlet the DOM node where the content for the current route
   *     is inserted.
   */
  setOutlet(outlet) {
    if (outlet) {
      this.__ensureOutlet(outlet);
    }
    this.__outlet = outlet;
  }

  /**
   * Returns the current router outlet. The initial value is `undefined`.
   *
   * @return {?Node} the current router outlet (or `undefined`)
   */
  getOutlet() {
    return this.__outlet;
  }

  /**
   * Sets the routing config (replacing the existing one) and triggers a
   * navigation event so that the router outlet is refreshed according to the
   * current `window.location` and the new routing config.
   *
   * Each route object may have the following properties, listed here in the processing order:
   * * `path` – the route path (relative to the parent route if any) in the
   * [express.js syntax](https://expressjs.com/en/guide/routing.html#route-paths").
   *
   * * `children` – an array of nested routes or a function that provides this
   * array at the render time. The function can be synchronous or asynchronous:
   * in the latter case the render is delayed until the returned promise is
   * resolved. The `children` function is executed every time when this route is
   * being rendered. This allows for dynamic route structures (e.g. backend-defined),
   * but it might have a performance impact as well. In order to avoid calling
   * the function on subsequent renders, you can override the `children` property
   * of the route object and save the calculated array there
   * (via `context.route.children = [ route1, route2, ...];`).
   * Parent routes are fully resolved before resolving the children. Children
   * 'path' values are relative to the parent ones.
   *
   * * `action` – the action that is executed before the route is resolved.
   * The value for this property should be a function, accepting `context`
   * and `commands` parameters described below. If present, this function is
   * always invoked first, disregarding of the other properties' presence.
   * The action can return a result directly or within a `Promise`, which
   * resolves to the result. If the action result is an `HTMLElement` instance,
   * a `commands.component(name)` result, a `commands.redirect(path)` result,
   * or a `context.next()` result, the current route resolution is finished,
   * and other route config properties are ignored.
   * See also **Route Actions** section in [Live Examples](#/classes/Router/demos/demo/index.html).
   *
   * * `redirect` – other route's path to redirect to. Passes all route parameters to the redirect target.
   * The target route should also be defined.
   * See also **Redirects** section in [Live Examples](#/classes/Router/demos/demo/index.html).
   *
   * * `bundle` – string containing the path to `.js` or `.mjs` bundle to load before resolving the route,
   * or the object with "module" and "nomodule" keys referring to different bundles.
   * Each bundle is only loaded once. If "module" and "nomodule" are set, only one bundle is loaded,
   * depending on whether the browser supports ES modules or not.
   * The property is ignored when either an `action` returns the result or `redirect` property is present.
   * Any error, e.g. 404 while loading bundle will cause route resolution to throw.
   * See also **Code Splitting** section in [Live Examples](#/classes/Router/demos/demo/index.html).
   *
   * * `component` – the tag name of the Web Component to resolve the route to.
   * The property is ignored when either an `action` returns the result or `redirect` property is present.
   * If route contains the `component` property (or an action that return a component)
   * and its child route also contains the `component` property, child route's component
   * will be rendered as a light dom child of a parent component.
   *
   * * `name` – the string name of the route to use in the
   * [`router.urlForName(name, params)`](#/classes/Router#method-urlForName)
   * navigation helper method.
   *
   * For any route function (`action`, `children`) defined, the corresponding `route` object is available inside the callback
   * through the `this` reference. If you need to access it, make sure you define the callback as a non-arrow function
   * because arrow functions do not have their own `this` reference.
   *
   * `context` object that is passed to `action` function holds the following properties:
   * * `context.pathname` – string with the pathname being resolved
   *
   * * `context.search` – search query string
   *
   * * `context.hash` – hash string
   *
   * * `context.params` – object with route parameters
   *
   * * `context.route` – object that holds the route that is currently being rendered.
   *
   * * `context.next()` – function for asynchronously getting the next route
   * contents from the resolution chain (if any)
   *
   * `commands` object that is passed to `action` function has
   * the following methods:
   *
   * * `commands.redirect(path)` – function that creates a redirect data
   * for the path specified.
   *
   * * `commands.component(component)` – function that creates a new HTMLElement
   * with current context. Note: the component created by this function is reused if visiting the same path twice in row.
   *
   *
   * @param {!Array<!Route>|!Route} routes a single route or an array of those
   * @param {?boolean} skipRender configure the router but skip rendering the
   *     route corresponding to the current `window.location` values
   *
   * @return {!Promise<!Node>}
   */
  setRoutes(routes, skipRender = false) {
    this.__previousContext = undefined;
    this.__urlForName = undefined;
    super.setRoutes(routes);
    if (!skipRender) {
      this.__onNavigationEvent();
    }
    return this.ready;
  }

  /**
   * Asynchronously resolves the given pathname and renders the resolved route
   * component into the router outlet. If no router outlet is set at the time of
   * calling this method, or at the time when the route resolution is completed,
   * a `TypeError` is thrown.
   *
   * Returns a promise that is fulfilled with the router outlet DOM Node after
   * the route component is created and inserted into the router outlet, or
   * rejected if no route matches the given path.
   *
   * If another render pass is started before the previous one is completed, the
   * result of the previous render pass is ignored.
   *
   * @param {!string|!{pathname: !string, search: ?string, hash: ?string}} pathnameOrContext
   *    the pathname to render or a context object with a `pathname` property,
   *    optional `search` and `hash` properties, and other properties
   *    to pass to the resolver.
   * @param {boolean=} shouldUpdateHistory
   *    update browser history with the rendered location
   * @return {!Promise<!Node>}
   */
  render(pathnameOrContext, shouldUpdateHistory) {
    const renderId = ++this.__lastStartedRenderId;
    const context = Object.assign(
      {
        search: '',
        hash: ''
      },
      isString(pathnameOrContext)
        ? {pathname: pathnameOrContext}
        : pathnameOrContext,
      {
        __renderId: renderId
      }
    );

    // Find the first route that resolves to a non-empty result
    this.ready = this.resolve(context)

      // Process the result of this.resolve() and handle all special commands:
      // (redirect / prevent / component). If the result is a 'component',
      // then go deeper and build the entire chain of nested components matching
      // the pathname. Also call all 'on before' callbacks along the way.
      .then(context => this.__fullyResolveChain(context))

      .then(context => {
        if (this.__isLatestRender(context)) {
          const previousContext = this.__previousContext;

          // Check if the render was prevented and make an early return in that case
          if (context === previousContext) {
            // Replace the history with the previous context
            // to make sure the URL stays the same.
            this.__updateBrowserHistory(previousContext, true);
            return this.location;
          }

          this.location = createLocation(context);

          if (shouldUpdateHistory) {
            // Replace only if first render redirects, so that we don’t leave
            // the redirecting record in the history
            this.__updateBrowserHistory(context, renderId === 1);
          }

          fireRouterEvent('location-changed', {router: this, location: this.location});

          // Skip detaching/re-attaching there are no render changes
          if (context.__skipAttach) {
            this.__copyUnchangedElements(context, previousContext);
            this.__previousContext = context;
            return this.location;
          }

          this.__addAppearingContent(context, previousContext);
          const animationDone = this.__animateIfNeeded(context);

          this.__runOnAfterEnterCallbacks(context);
          this.__runOnAfterLeaveCallbacks(context, previousContext);

          return animationDone.then(() => {
            if (this.__isLatestRender(context)) {
              // If there is another render pass started after this one,
              // the 'disappearing content' would be removed when the other
              // render pass calls `this.__addAppearingContent()`
              this.__removeDisappearingContent();

              this.__previousContext = context;
              return this.location;
            }
          });
        }
      })
      .catch(error => {
        if (renderId === this.__lastStartedRenderId) {
          if (shouldUpdateHistory) {
            this.__updateBrowserHistory(context);
          }
          removeDomNodes(this.__outlet && this.__outlet.children);
          this.location = createLocation(Object.assign(context, {resolver: this}));
          fireRouterEvent('error', Object.assign({router: this, error}, context));
          throw error;
        }
      });
    return this.ready;
  }

  // `topOfTheChainContextBeforeRedirects` is a context coming from Resolver.resolve().
  // It would contain a 'redirect' route or the first 'component' route that
  // matched the pathname. There might be more child 'component' routes to be
  // resolved and added into the chain. This method would find and add them.
  // `contextBeforeRedirects` is the context containing such a child component
  // route. It's only necessary when this method is called recursively (otherwise
  // it's the same as the 'top of the chain' context).
  //
  // Apart from building the chain of child components, this method would also
  // handle 'redirect' routes, call 'onBefore' callbacks and handle 'prevent'
  // and 'redirect' callback results.
  __fullyResolveChain(topOfTheChainContextBeforeRedirects,
    contextBeforeRedirects = topOfTheChainContextBeforeRedirects) {
    return this.__findComponentContextAfterAllRedirects(contextBeforeRedirects)
      // `contextAfterRedirects` is always a context with an `HTMLElement` result
      // In other cases the promise gets rejected and .then() is not called
      .then(contextAfterRedirects => {
        const redirectsHappened = contextAfterRedirects !== contextBeforeRedirects;
        const topOfTheChainContextAfterRedirects =
          redirectsHappened ? contextAfterRedirects : topOfTheChainContextBeforeRedirects;

        const matchedPath = getPathnameForRouter(
          getMatchedPath(contextAfterRedirects.chain),
          contextAfterRedirects.resolver
        );
        const isFound = (matchedPath === contextAfterRedirects.pathname);

        // Recursive method to try matching more child and sibling routes
        const findNextContextIfAny = (context, parent = context.route, prevResult) => {
          return context.next(undefined, parent, prevResult).then(nextContext => {
            if (nextContext === null || nextContext === notFoundResult) {
              // Next context is not found in children, ...
              if (isFound) {
                // ...but original context is already fully matching - use it
                return context;
              } else if (parent.parent !== null) {
                // ...and there is no full match yet - step up to check siblings
                return findNextContextIfAny(context, parent.parent, nextContext);
              } else {
                return nextContext;
              }
            }

            return nextContext;
          });
        };

        return findNextContextIfAny(contextAfterRedirects).then(nextContext => {
          if (nextContext === null || nextContext === notFoundResult) {
            throw getNotFoundError(topOfTheChainContextAfterRedirects);
          }

          return nextContext
          && nextContext !== notFoundResult
          && nextContext !== contextAfterRedirects
            ? this.__fullyResolveChain(topOfTheChainContextAfterRedirects, nextContext)
            : this.__amendWithOnBeforeCallbacks(contextAfterRedirects);
        });
      });
  }

  __findComponentContextAfterAllRedirects(context) {
    const result = context.result;
    if (result instanceof HTMLElement) {
      renderElement(context, result);
      return Promise.resolve(context);
    } else if (result.redirect) {
      return this.__redirect(result.redirect, context.__redirectCount, context.__renderId)
        .then(context => this.__findComponentContextAfterAllRedirects(context));
    } else if (result instanceof Error) {
      return Promise.reject(result);
    } else {
      return Promise.reject(
        new Error(
          log(
            `Invalid route resolution result for path "${context.pathname}". ` +
            `Expected redirect object or HTML element, but got: "${logValue(result)}". ` +
            `Double check the action return value for the route.`
          )
        ));
    }
  }

  __amendWithOnBeforeCallbacks(contextWithFullChain) {
    return this.__runOnBeforeCallbacks(contextWithFullChain).then(amendedContext => {
      if (amendedContext === this.__previousContext || amendedContext === contextWithFullChain) {
        return amendedContext;
      }
      return this.__fullyResolveChain(amendedContext);
    });
  }

  __runOnBeforeCallbacks(newContext) {
    const previousContext = this.__previousContext || {};
    const previousChain = previousContext.chain || [];
    const newChain = newContext.chain;

    let callbacks = Promise.resolve();
    const prevent = () => ({cancel: true});
    const redirect = (pathname) => createRedirect(newContext, pathname);

    newContext.__divergedChainIndex = 0;
    newContext.__skipAttach = false;
    if (previousChain.length) {
      for (let i = 0; i < Math.min(previousChain.length, newChain.length); i = ++newContext.__divergedChainIndex) {
        if (previousChain[i].route !== newChain[i].route
          || previousChain[i].path !== newChain[i].path && previousChain[i].element !== newChain[i].element
          || !this.__isReusableElement(previousChain[i].element, newChain[i].element)) {
          break;
        }
      }

      // Skip re-attaching and notifications if element and chain do not change
      newContext.__skipAttach =
        // Same route chain
        newChain.length === previousChain.length && newContext.__divergedChainIndex == newChain.length &&
        // Same element
        this.__isReusableElement(newContext.result, previousContext.result);

      if (newContext.__skipAttach) {
        // execute onBeforeLeave for changed segment element when skipping attach
        for (let i = newChain.length - 1; i >= 0; i--) {
          callbacks = this.__runOnBeforeLeaveCallbacks(callbacks, newContext, {prevent}, previousChain[i]);
        }
        // execute onBeforeEnter for changed segment element when skipping attach
        for (let i = 0; i < newChain.length; i++) {
          callbacks = this.__runOnBeforeEnterCallbacks(callbacks, newContext, {prevent, redirect}, newChain[i]);
          previousChain[i].element.location = createLocation(newContext, previousChain[i].route);
        }

      } else {
        // execute onBeforeLeave when NOT skipping attach
        for (let i = previousChain.length - 1; i >= newContext.__divergedChainIndex; i--) {
          callbacks = this.__runOnBeforeLeaveCallbacks(callbacks, newContext, {prevent}, previousChain[i]);
        }
      }
    }
    // execute onBeforeEnter when NOT skipping attach
    if (!newContext.__skipAttach) {
      for (let i = 0; i < newChain.length; i++) {
        if (i < newContext.__divergedChainIndex) {
          if (i < previousChain.length && previousChain[i].element) {
            previousChain[i].element.location = createLocation(newContext, previousChain[i].route);
          }
        } else {
          callbacks = this.__runOnBeforeEnterCallbacks(callbacks, newContext, {prevent, redirect}, newChain[i]);
          if (newChain[i].element) {
            newChain[i].element.location = createLocation(newContext, newChain[i].route);
          }
        }
      }
    }
    return callbacks.then(amendmentResult => {
      if (amendmentResult) {
        if (amendmentResult.cancel) {
          this.__previousContext.__renderId = newContext.__renderId;
          return this.__previousContext;
        }
        if (amendmentResult.redirect) {
          return this.__redirect(amendmentResult.redirect, newContext.__redirectCount, newContext.__renderId);
        }
      }
      return newContext;
    });
  }

  __runOnBeforeLeaveCallbacks(callbacks, newContext, commands, chainElement) {
    const location = createLocation(newContext);
    return callbacks.then(result => {
      if (this.__isLatestRender(newContext)) {
        const afterLeaveFunction = amend('onBeforeLeave', [location, commands, this], chainElement.element);
        return afterLeaveFunction(result);
      }
    }).then(result => {
      if (!(result || {}).redirect) {
        return result;
      }
    });
  }

  __runOnBeforeEnterCallbacks(callbacks, newContext, commands, chainElement) {
    const location = createLocation(newContext, chainElement.route);
    return callbacks.then(result => {
      if (this.__isLatestRender(newContext)) {
        const beforeEnterFunction = amend('onBeforeEnter', [location, commands, this], chainElement.element);
        return beforeEnterFunction(result);
      }
    });
  }

  __isReusableElement(element, otherElement) {
    if (element && otherElement) {
      return this.__createdByRouter.get(element) && this.__createdByRouter.get(otherElement)
        ? element.localName === otherElement.localName
        : element === otherElement;
    }
    return false;
  }

  __isLatestRender(context) {
    return context.__renderId === this.__lastStartedRenderId;
  }

  __redirect(redirectData, counter, renderId) {
    if (counter > MAX_REDIRECT_COUNT) {
      throw new Error(log(`Too many redirects when rendering ${redirectData.from}`));
    }

    return this.resolve({
      pathname: this.urlForPath(
        redirectData.pathname,
        redirectData.params
      ),
      redirectFrom: redirectData.from,
      __redirectCount: (counter || 0) + 1,
      __renderId: renderId
    });
  }

  __ensureOutlet(outlet = this.__outlet) {
    if (!(outlet instanceof Node)) {
      throw new TypeError(log(`Expected router outlet to be a valid DOM Node (but got ${outlet})`));
    }
  }

  __updateBrowserHistory({pathname, search = '', hash = ''}, replace) {
    if (window.location.pathname !== pathname
        || window.location.search !== search
        || window.location.hash !== hash
    ) {
      const changeState = replace ? 'replaceState' : 'pushState';
      window.history[changeState](null, document.title, pathname + search + hash);
      window.dispatchEvent(new PopStateEvent('popstate', {state: 'vaadin-router-ignore'}));
    }
  }

  __copyUnchangedElements(context, previousContext) {
    // Find the deepest common parent between the last and the new component
    // chains. Update references for the unchanged elements in the new chain
    let deepestCommonParent = this.__outlet;
    for (let i = 0; i < context.__divergedChainIndex; i++) {
      const unchangedElement = previousContext && previousContext.chain[i].element;
      if (unchangedElement) {
        if (unchangedElement.parentNode === deepestCommonParent) {
          context.chain[i].element = unchangedElement;
          deepestCommonParent = unchangedElement;
        } else {
          break;
        }
      }
    }
    return deepestCommonParent;
  }

  __addAppearingContent(context, previousContext) {
    this.__ensureOutlet();

    // If the previous 'entering' animation has not completed yet,
    // stop it and remove that content from the DOM before adding new one.
    this.__removeAppearingContent();

    // Copy reusable elements from the previousContext to current
    const deepestCommonParent = this.__copyUnchangedElements(context, previousContext);

    // Keep two lists of DOM elements:
    //  - those that should be removed once the transition animation is over
    //  - and those that should remain
    this.__appearingContent = [];
    this.__disappearingContent = Array
      .from(deepestCommonParent.children)
      .filter(
        // Only remove layout content that was added by router
        e => this.__addedByRouter.get(e) &&
        // Do not remove the result element to avoid flickering
        e !== context.result);

    // Add new elements (starting after the deepest common parent) to the DOM.
    // That way only the components that are actually different between the two
    // locations are added to the DOM (and those that are common remain in the
    // DOM without first removing and then adding them again).
    let parentElement = deepestCommonParent;
    for (let i = context.__divergedChainIndex; i < context.chain.length; i++) {
      const elementToAdd = context.chain[i].element;
      if (elementToAdd) {
        parentElement.appendChild(elementToAdd);
        this.__addedByRouter.set(elementToAdd, true);
        if (parentElement === deepestCommonParent) {
          this.__appearingContent.push(elementToAdd);
        }
        parentElement = elementToAdd;
      }
    }
  }

  __removeDisappearingContent() {
    if (this.__disappearingContent) {
      removeDomNodes(this.__disappearingContent);
    }
    this.__disappearingContent = null;
    this.__appearingContent = null;
  }

  __removeAppearingContent() {
    if (this.__disappearingContent && this.__appearingContent) {
      removeDomNodes(this.__appearingContent);
      this.__disappearingContent = null;
      this.__appearingContent = null;
    }
  }

  __runOnAfterLeaveCallbacks(currentContext, targetContext) {
    if (!targetContext) {
      return;
    }

    // REVERSE iteration: from Z to A
    for (let i = targetContext.chain.length - 1; i >= currentContext.__divergedChainIndex; i--) {
      if (!this.__isLatestRender(currentContext)) {
        break;
      }
      const currentComponent = targetContext.chain[i].element;
      if (!currentComponent) {
        continue;
      }
      try {
        const location = createLocation(currentContext);
        runCallbackIfPossible(
          currentComponent.onAfterLeave,
          [location, {}, targetContext.resolver],
          currentComponent);
      } finally {
        if (this.__disappearingContent.indexOf(currentComponent) > -1) {
          removeDomNodes(currentComponent.children);
        }
      }
    }
  }

  __runOnAfterEnterCallbacks(currentContext) {
    // forward iteration: from A to Z
    for (let i = currentContext.__divergedChainIndex; i < currentContext.chain.length; i++) {
      if (!this.__isLatestRender(currentContext)) {
        break;
      }
      const currentComponent = currentContext.chain[i].element || {};
      const location = createLocation(currentContext, currentContext.chain[i].route);
      runCallbackIfPossible(
        currentComponent.onAfterEnter,
        [location, {}, currentContext.resolver],
        currentComponent);
    }
  }

  __animateIfNeeded(context) {
    const from = (this.__disappearingContent || [])[0];
    const to = (this.__appearingContent || [])[0];
    const promises = [];

    const chain = context.chain;
    let config;
    for (let i = chain.length; i > 0; i--) {
      if (chain[i - 1].route.animate) {
        config = chain[i - 1].route.animate;
        break;
      }
    }

    if (from && to && config) {
      const leave = isObject(config) && config.leave || 'leaving';
      const enter = isObject(config) && config.enter || 'entering';
      promises.push(animate(from, leave));
      promises.push(animate(to, enter));
    }

    return Promise.all(promises).then(() => context);
  }

  /**
   * Subscribes this instance to navigation events on the `window`.
   *
   * NOTE: beware of resource leaks. For as long as a router instance is
   * subscribed to navigation events, it won't be garbage collected.
   */
  subscribe() {
    window.addEventListener('vaadin-router-go', this.__navigationEventHandler);
  }

  /**
   * Removes the subscription to navigation events created in the `subscribe()`
   * method.
   */
  unsubscribe() {
    window.removeEventListener('vaadin-router-go', this.__navigationEventHandler);
  }

  __onNavigationEvent(event) {
    const {pathname, search, hash} = event ? event.detail : window.location;
    if (isString(this.__normalizePathname(pathname))) {
      if (event && event.preventDefault) {
        event.preventDefault();
      }
      this.render({pathname, search, hash}, true);
    }
  }

  /**
   * Configures what triggers Router navigation events:
   *  - `POPSTATE`: popstate events on the current `window`
   *  - `CLICK`: click events on `<a>` links leading to the current page
   *
   * This method is invoked with the pre-configured values when creating a new Router instance.
   * By default, both `POPSTATE` and `CLICK` are enabled. This setup is expected to cover most of the use cases.
   *
   * See the `router-config.js` for the default navigation triggers config. Based on it, you can
   * create the own one and only import the triggers you need, instead of pulling in all the code,
   * e.g. if you want to handle `click` differently.
   *
   * See also **Navigation Triggers** section in [Live Examples](#/classes/Router/demos/demo/index.html).
   *
   * @param {...NavigationTrigger} triggers
   */
  static setTriggers(...triggers) {
    setNavigationTriggers(triggers);
  }

  /**
   * Generates a URL for the route with the given name, optionally performing
   * substitution of parameters.
   *
   * The route is searched in all the Router instances subscribed to
   * navigation events.
   *
   * **Note:** For child route names, only array children are considered.
   * It is not possible to generate URLs using a name for routes set with
   * a children function.
   *
   * @function urlForName
   * @param {!string} name the route name or the route’s `component` name.
   * @param {Params=} params Optional object with route path parameters.
   * Named parameters are passed by name (`params[name] = value`), unnamed
   * parameters are passed by index (`params[index] = value`).
   *
   * @return {string}
   */
  urlForName(name, params) {
    if (!this.__urlForName) {
      this.__urlForName = generateUrls(this);
    }
    return getPathnameForRouter(
      this.__urlForName(name, params),
      this
    );
  }

  /**
   * Generates a URL for the given route path, optionally performing
   * substitution of parameters.
   *
   * @param {!string} path string route path declared in [express.js syntax](https://expressjs.com/en/guide/routing.html#route-paths").
   * @param {Params=} params Optional object with route path parameters.
   * Named parameters are passed by name (`params[name] = value`), unnamed
   * parameters are passed by index (`params[index] = value`).
   *
   * @return {string}
   */
  urlForPath(path, params) {
    return getPathnameForRouter(
      Router.pathToRegexp.compile(path)(params),
      this
    );
  }

  /**
   * Triggers navigation to a new path. Returns a boolean without waiting until
   * the navigation is complete. Returns `true` if at least one `Router`
   * has handled the navigation (was subscribed and had `baseUrl` matching
   * the `path` argument), otherwise returns `false`.
   *
   * @param {!string|!{pathname: !string, search: (string|undefined), hash: (string|undefined)}} path
   *   a new in-app path string, or an URL-like object with `pathname`
   *   string property, and optional `search` and `hash` string properties.
   * @return {boolean}
   */
  static go(path) {
    const {pathname, search, hash} = isString(path)
      ? this.__createUrl(path, 'http://a') // some base to omit origin
      : path;
    return fireRouterEvent('go', {pathname, search, hash});
  }
}

const DEV_MODE_CODE_REGEXP =
  /\/\*\*\s+vaadin-dev-mode:start([\s\S]*)vaadin-dev-mode:end\s+\*\*\//i;

const FlowClients = window.Vaadin && window.Vaadin.Flow && window.Vaadin.Flow.clients;

function isMinified() {
  function test() {
    /** vaadin-dev-mode:start
    return false;
    vaadin-dev-mode:end **/
    return true;
  }
  return uncommentAndRun(test);
}

function isDevelopmentMode() {
  try {
    if (isForcedDevelopmentMode()) {
      return true;
    }

    if (!isLocalhost()) {
      return false;
    }

    if (FlowClients) {
      return !isFlowProductionMode();
    }

    return !isMinified();
  } catch (e) {
    // Some error in this code, assume production so no further actions will be taken
    return false;
  }
}

function isForcedDevelopmentMode() {
  return localStorage.getItem("vaadin.developmentmode.force");
}

function isLocalhost() {
  return (["localhost","127.0.0.1"].indexOf(window.location.hostname) >= 0);
}

function isFlowProductionMode() {
  if (FlowClients) {
    const productionModeApps = Object.keys(FlowClients)
      .map(key => FlowClients[key])
      .filter(client => client.productionMode);
    if (productionModeApps.length > 0) {
      return true;
    }
  }
  return false;
}

function uncommentAndRun(callback, args) {
  if (typeof callback !== 'function') {
    return;
  }

  const match = DEV_MODE_CODE_REGEXP.exec(callback.toString());
  if (match) {
    try {
      // requires CSP: script-src 'unsafe-eval'
      callback = new Function(match[1]);
    } catch (e) {
      // eat the exception
      console.log('vaadin-development-mode-detector: uncommentAndRun() failed', e);
    }
  }

  return callback(args);
}

// A guard against polymer-modulizer removing the window.Vaadin
// initialization above.
window['Vaadin'] = window['Vaadin'] || {};

/**
 * Inspects the source code of the given `callback` function for
 * specially-marked _commented_ code. If such commented code is found in the
 * callback source, uncomments and runs that code instead of the callback
 * itself. Otherwise runs the callback as is.
 *
 * The optional arguments are passed into the callback / uncommented code,
 * the result is returned.
 *
 * See the `isMinified()` function source code in this file for an example.
 *
 */
const runIfDevelopmentMode = function(callback, args) {
  if (window.Vaadin.developmentMode) {
    return uncommentAndRun(callback, args);
  }
};

if (window.Vaadin.developmentMode === undefined) {
  window.Vaadin.developmentMode = isDevelopmentMode();
}

/* This file is autogenerated from src/vaadin-usage-statistics.tpl.html */

function maybeGatherAndSendStats() {
  /** vaadin-dev-mode:start
  (function () {
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
  return typeof obj;
} : function (obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
};

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();

var getPolymerVersion = function getPolymerVersion() {
  return window.Polymer && window.Polymer.version;
};

var StatisticsGatherer = function () {
  function StatisticsGatherer(logger) {
    classCallCheck(this, StatisticsGatherer);

    this.now = new Date().getTime();
    this.logger = logger;
  }

  createClass(StatisticsGatherer, [{
    key: 'frameworkVersionDetectors',
    value: function frameworkVersionDetectors() {
      return {
        'Flow': function Flow() {
          if (window.Vaadin && window.Vaadin.Flow && window.Vaadin.Flow.clients) {
            var flowVersions = Object.keys(window.Vaadin.Flow.clients).map(function (key) {
              return window.Vaadin.Flow.clients[key];
            }).filter(function (client) {
              return client.getVersionInfo;
            }).map(function (client) {
              return client.getVersionInfo().flow;
            });
            if (flowVersions.length > 0) {
              return flowVersions[0];
            }
          }
        },
        'Vaadin Framework': function VaadinFramework() {
          if (window.vaadin && window.vaadin.clients) {
            var frameworkVersions = Object.values(window.vaadin.clients).filter(function (client) {
              return client.getVersionInfo;
            }).map(function (client) {
              return client.getVersionInfo().vaadinVersion;
            });
            if (frameworkVersions.length > 0) {
              return frameworkVersions[0];
            }
          }
        },
        'AngularJs': function AngularJs() {
          if (window.angular && window.angular.version && window.angular.version) {
            return window.angular.version.full;
          }
        },
        'Angular': function Angular() {
          if (window.ng) {
            var tags = document.querySelectorAll("[ng-version]");
            if (tags.length > 0) {
              return tags[0].getAttribute("ng-version");
            }
            return "Unknown";
          }
        },
        'Backbone.js': function BackboneJs() {
          if (window.Backbone) {
            return window.Backbone.VERSION;
          }
        },
        'React': function React() {
          var reactSelector = '[data-reactroot], [data-reactid]';
          if (!!document.querySelector(reactSelector)) {
            // React does not publish the version by default
            return "unknown";
          }
        },
        'Ember': function Ember() {
          if (window.Em && window.Em.VERSION) {
            return window.Em.VERSION;
          } else if (window.Ember && window.Ember.VERSION) {
            return window.Ember.VERSION;
          }
        },
        'jQuery': function (_jQuery) {
          function jQuery() {
            return _jQuery.apply(this, arguments);
          }

          jQuery.toString = function () {
            return _jQuery.toString();
          };

          return jQuery;
        }(function () {
          if (typeof jQuery === 'function' && jQuery.prototype.jquery !== undefined) {
            return jQuery.prototype.jquery;
          }
        }),
        'Polymer': function Polymer() {
          var version = getPolymerVersion();
          if (version) {
            return version;
          }
        },
        'LitElement': function LitElement() {
          var version = window.litElementVersions && window.litElementVersions[0];
          if (version) {
            return version;
          }
        },
        'LitHtml': function LitHtml() {
          var version = window.litHtmlVersions && window.litHtmlVersions[0];
          if (version) {
            return version;
          }
        },
        'Vue.js': function VueJs() {
          if (window.Vue) {
            return window.Vue.version;
          }
        }
      };
    }
  }, {
    key: 'getUsedVaadinElements',
    value: function getUsedVaadinElements(elements) {
      var version = getPolymerVersion();
      var elementClasses = void 0;
      // NOTE: In case you edit the code here, YOU MUST UPDATE any statistics reporting code in Flow.
      // Check all locations calling the method getEntries() in
      // https://github.com/vaadin/flow/blob/master/flow-server/src/main/java/com/vaadin/flow/internal/UsageStatistics.java#L106
      // Currently it is only used by BootstrapHandler.
      if (version && version.indexOf('2') === 0) {
        // Polymer 2: components classes are stored in window.Vaadin
        elementClasses = Object.keys(window.Vaadin).map(function (c) {
          return window.Vaadin[c];
        }).filter(function (c) {
          return c.is;
        });
      } else {
        // Polymer 3: components classes are stored in window.Vaadin.registrations
        elementClasses = window.Vaadin.registrations || [];
      }
      elementClasses.forEach(function (klass) {
        var version = klass.version ? klass.version : "0.0.0";
        elements[klass.is] = { version: version };
      });
    }
  }, {
    key: 'getUsedVaadinThemes',
    value: function getUsedVaadinThemes(themes) {
      ['Lumo', 'Material'].forEach(function (themeName) {
        var theme;
        var version = getPolymerVersion();
        if (version && version.indexOf('2') === 0) {
          // Polymer 2: themes are stored in window.Vaadin
          theme = window.Vaadin[themeName];
        } else {
          // Polymer 3: themes are stored in custom element registry
          theme = customElements.get('vaadin-' + themeName.toLowerCase() + '-styles');
        }
        if (theme && theme.version) {
          themes[themeName] = { version: theme.version };
        }
      });
    }
  }, {
    key: 'getFrameworks',
    value: function getFrameworks(frameworks) {
      var detectors = this.frameworkVersionDetectors();
      Object.keys(detectors).forEach(function (framework) {
        var detector = detectors[framework];
        try {
          var version = detector();
          if (version) {
            frameworks[framework] = { version: version };
          }
        } catch (e) {}
      });
    }
  }, {
    key: 'gather',
    value: function gather(storage) {
      var storedStats = storage.read();
      var gatheredStats = {};
      var types = ["elements", "frameworks", "themes"];

      types.forEach(function (type) {
        gatheredStats[type] = {};
        if (!storedStats[type]) {
          storedStats[type] = {};
        }
      });

      var previousStats = JSON.stringify(storedStats);

      this.getUsedVaadinElements(gatheredStats.elements);
      this.getFrameworks(gatheredStats.frameworks);
      this.getUsedVaadinThemes(gatheredStats.themes);

      var now = this.now;
      types.forEach(function (type) {
        var keys = Object.keys(gatheredStats[type]);
        keys.forEach(function (key) {
          if (!storedStats[type][key] || _typeof(storedStats[type][key]) != _typeof({})) {
            storedStats[type][key] = { firstUsed: now };
          }
          // Discards any previously logged version number
          storedStats[type][key].version = gatheredStats[type][key].version;
          storedStats[type][key].lastUsed = now;
        });
      });

      var newStats = JSON.stringify(storedStats);
      storage.write(newStats);
      if (newStats != previousStats && Object.keys(storedStats).length > 0) {
        this.logger.debug("New stats: " + newStats);
      }
    }
  }]);
  return StatisticsGatherer;
}();

var StatisticsStorage = function () {
  function StatisticsStorage(key) {
    classCallCheck(this, StatisticsStorage);

    this.key = key;
  }

  createClass(StatisticsStorage, [{
    key: 'read',
    value: function read() {
      var localStorageStatsString = localStorage.getItem(this.key);
      try {
        return JSON.parse(localStorageStatsString ? localStorageStatsString : '{}');
      } catch (e) {
        return {};
      }
    }
  }, {
    key: 'write',
    value: function write(data) {
      localStorage.setItem(this.key, data);
    }
  }, {
    key: 'clear',
    value: function clear() {
      localStorage.removeItem(this.key);
    }
  }, {
    key: 'isEmpty',
    value: function isEmpty() {
      var storedStats = this.read();
      var empty = true;
      Object.keys(storedStats).forEach(function (key) {
        if (Object.keys(storedStats[key]).length > 0) {
          empty = false;
        }
      });

      return empty;
    }
  }]);
  return StatisticsStorage;
}();

var StatisticsSender = function () {
  function StatisticsSender(url, logger) {
    classCallCheck(this, StatisticsSender);

    this.url = url;
    this.logger = logger;
  }

  createClass(StatisticsSender, [{
    key: 'send',
    value: function send(data, errorHandler) {
      var logger = this.logger;

      if (navigator.onLine === false) {
        logger.debug("Offline, can't send");
        errorHandler();
        return;
      }
      logger.debug("Sending data to " + this.url);

      var req = new XMLHttpRequest();
      req.withCredentials = true;
      req.addEventListener("load", function () {
        // Stats sent, nothing more to do
        logger.debug("Response: " + req.responseText);
      });
      req.addEventListener("error", function () {
        logger.debug("Send failed");
        errorHandler();
      });
      req.addEventListener("abort", function () {
        logger.debug("Send aborted");
        errorHandler();
      });
      req.open("POST", this.url);
      req.setRequestHeader("Content-Type", "application/json");
      req.send(data);
    }
  }]);
  return StatisticsSender;
}();

var StatisticsLogger = function () {
  function StatisticsLogger(id) {
    classCallCheck(this, StatisticsLogger);

    this.id = id;
  }

  createClass(StatisticsLogger, [{
    key: '_isDebug',
    value: function _isDebug() {
      return localStorage.getItem("vaadin." + this.id + ".debug");
    }
  }, {
    key: 'debug',
    value: function debug(msg) {
      if (this._isDebug()) {
        console.info(this.id + ": " + msg);
      }
    }
  }]);
  return StatisticsLogger;
}();

var UsageStatistics = function () {
  function UsageStatistics() {
    classCallCheck(this, UsageStatistics);

    this.now = new Date();
    this.timeNow = this.now.getTime();
    this.gatherDelay = 10; // Delay between loading this file and gathering stats
    this.initialDelay = 24 * 60 * 60;

    this.logger = new StatisticsLogger("statistics");
    this.storage = new StatisticsStorage("vaadin.statistics.basket");
    this.gatherer = new StatisticsGatherer(this.logger);
    this.sender = new StatisticsSender("https://tools.vaadin.com/usage-stats/submit", this.logger);
  }

  createClass(UsageStatistics, [{
    key: 'maybeGatherAndSend',
    value: function maybeGatherAndSend() {
      var _this = this;

      if (localStorage.getItem(UsageStatistics.optOutKey)) {
        return;
      }
      this.gatherer.gather(this.storage);
      setTimeout(function () {
        _this.maybeSend();
      }, this.gatherDelay * 1000);
    }
  }, {
    key: 'lottery',
    value: function lottery() {
      return true;
    }
  }, {
    key: 'currentMonth',
    value: function currentMonth() {
      return this.now.getYear() * 12 + this.now.getMonth();
    }
  }, {
    key: 'maybeSend',
    value: function maybeSend() {
      var firstUse = Number(localStorage.getItem(UsageStatistics.firstUseKey));
      var monthProcessed = Number(localStorage.getItem(UsageStatistics.monthProcessedKey));

      if (!firstUse) {
        // Use a grace period to avoid interfering with tests, incognito mode etc
        firstUse = this.timeNow;
        localStorage.setItem(UsageStatistics.firstUseKey, firstUse);
      }

      if (this.timeNow < firstUse + this.initialDelay * 1000) {
        this.logger.debug("No statistics will be sent until the initial delay of " + this.initialDelay + "s has passed");
        return;
      }
      if (this.currentMonth() <= monthProcessed) {
        this.logger.debug("This month has already been processed");
        return;
      }
      localStorage.setItem(UsageStatistics.monthProcessedKey, this.currentMonth());
      // Use random sampling
      if (this.lottery()) {
        this.logger.debug("Congratulations, we have a winner!");
      } else {
        this.logger.debug("Sorry, no stats from you this time");
        return;
      }

      this.send();
    }
  }, {
    key: 'send',
    value: function send() {
      // Ensure we have the latest data
      this.gatherer.gather(this.storage);

      // Read, send and clean up
      var data = this.storage.read();
      data["firstUse"] = Number(localStorage.getItem(UsageStatistics.firstUseKey));
      data["usageStatisticsVersion"] = UsageStatistics.version;
      var info = 'This request contains usage statistics gathered from the application running in development mode. \n\nStatistics gathering is automatically disabled and excluded from production builds.\n\nFor details and to opt-out, see https://github.com/vaadin/vaadin-usage-statistics.\n\n\n\n';
      var self = this;
      this.sender.send(info + JSON.stringify(data), function () {
        // Revert the 'month processed' flag
        localStorage.setItem(UsageStatistics.monthProcessedKey, self.currentMonth() - 1);
      });
    }
  }], [{
    key: 'version',
    get: function get$1() {
      return '2.1.0';
    }
  }, {
    key: 'firstUseKey',
    get: function get$1() {
      return 'vaadin.statistics.firstuse';
    }
  }, {
    key: 'monthProcessedKey',
    get: function get$1() {
      return 'vaadin.statistics.monthProcessed';
    }
  }, {
    key: 'optOutKey',
    get: function get$1() {
      return 'vaadin.statistics.optout';
    }
  }]);
  return UsageStatistics;
}();

try {
  window.Vaadin = window.Vaadin || {};
  window.Vaadin.usageStatsChecker = window.Vaadin.usageStatsChecker || new UsageStatistics();
  window.Vaadin.usageStatsChecker.maybeGatherAndSend();
} catch (e) {
  // Intentionally ignored as this is not a problem in the app being developed
}

}());

  vaadin-dev-mode:end **/
}

const usageStatistics = function() {
  if (typeof runIfDevelopmentMode === 'function') {
    return runIfDevelopmentMode(maybeGatherAndSendStats);
  }
};

window.Vaadin = window.Vaadin || {};
window.Vaadin.registrations = window.Vaadin.registrations || [];

window.Vaadin.registrations.push({
  is: '@vaadin/router',
  version: '1.7.4',
});

usageStatistics();

Router.NavigationTrigger = {POPSTATE, CLICK};

// import { Router } from '@vaadin/router';

window.addEventListener('load', () => {
    initRouter();
});

const initRouter = () => {
    const routerOutput = document.querySelector('#router-output');
    const router = new Router(routerOutput);
    router.setRoutes([
        {
            path: '/',
            component: 'cursuscoordinator-page',
            action: () => Promise.resolve().then(function () { return cursuscoordinatorPage$1; })
        },
        {
            path: '/index.html',
            component: 'student-page'
        },
        {
            path: '/crud',
            component: 'crud-page'
        },
        {
            path: '/nieuw-vak',
            component: 'crud-page',
            action: () => Promise.resolve().then(function () { return crudPage$1; })
        },
        {
            path: '/login',
            component: 'student-page',
            action: () => Promise.resolve().then(function () { return studentPage$1; })
        },
        {
            path: '/vak-edit',
            component: 'cursuscoordinator-page',
            action: () => Promise.resolve().then(function () { return cursuscoordinatorPage$1; })
        },
        {
            path: '(.*)',
            component: 'page-not-found'
        }
    ]);
};

/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const t$2=window.ShadowRoot&&(void 0===window.ShadyCSS||window.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,e$2=Symbol(),n$4=new Map;class s$4{constructor(t,n){if(this._$cssResult$=!0,n!==e$2)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t;}get styleSheet(){let e=n$4.get(this.cssText);return t$2&&void 0===e&&(n$4.set(this.cssText,e=new CSSStyleSheet),e.replaceSync(this.cssText)),e}toString(){return this.cssText}}const o$4=t=>new s$4("string"==typeof t?t:t+"",e$2),r$3=(t,...n)=>{const o=1===t.length?t[0]:n.reduce(((e,n,s)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(n)+t[s+1]),t[0]);return new s$4(o,e$2)},i$3=(e,n)=>{t$2?e.adoptedStyleSheets=n.map((t=>t instanceof CSSStyleSheet?t:t.styleSheet)):n.forEach((t=>{const n=document.createElement("style"),s=window.litNonce;void 0!==s&&n.setAttribute("nonce",s),n.textContent=t.cssText,e.appendChild(n);}));},S$2=t$2?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const n of t.cssRules)e+=n.cssText;return o$4(e)})(t):t;

/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */var s$3;const e$1=window.trustedTypes,r$2=e$1?e$1.emptyScript:"",h$2=window.reactiveElementPolyfillSupport,o$3={toAttribute(t,i){switch(i){case Boolean:t=t?r$2:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t);}return t},fromAttribute(t,i){let s=t;switch(i){case Boolean:s=null!==t;break;case Number:s=null===t?null:Number(t);break;case Object:case Array:try{s=JSON.parse(t);}catch(t){s=null;}}return s}},n$3=(t,i)=>i!==t&&(i==i||t==t),l$3={attribute:!0,type:String,converter:o$3,reflect:!1,hasChanged:n$3};class a$2 extends HTMLElement{constructor(){super(),this._$Et=new Map,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Ei=null,this.o();}static addInitializer(t){var i;null!==(i=this.l)&&void 0!==i||(this.l=[]),this.l.push(t);}static get observedAttributes(){this.finalize();const t=[];return this.elementProperties.forEach(((i,s)=>{const e=this._$Eh(s,i);void 0!==e&&(this._$Eu.set(e,s),t.push(e));})),t}static createProperty(t,i=l$3){if(i.state&&(i.attribute=!1),this.finalize(),this.elementProperties.set(t,i),!i.noAccessor&&!this.prototype.hasOwnProperty(t)){const s="symbol"==typeof t?Symbol():"__"+t,e=this.getPropertyDescriptor(t,s,i);void 0!==e&&Object.defineProperty(this.prototype,t,e);}}static getPropertyDescriptor(t,i,s){return {get(){return this[i]},set(e){const r=this[t];this[i]=e,this.requestUpdate(t,r,s);},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)||l$3}static finalize(){if(this.hasOwnProperty("finalized"))return !1;this.finalized=!0;const t=Object.getPrototypeOf(this);if(t.finalize(),this.elementProperties=new Map(t.elementProperties),this._$Eu=new Map,this.hasOwnProperty("properties")){const t=this.properties,i=[...Object.getOwnPropertyNames(t),...Object.getOwnPropertySymbols(t)];for(const s of i)this.createProperty(s,t[s]);}return this.elementStyles=this.finalizeStyles(this.styles),!0}static finalizeStyles(i){const s=[];if(Array.isArray(i)){const e=new Set(i.flat(1/0).reverse());for(const i of e)s.unshift(S$2(i));}else void 0!==i&&s.push(S$2(i));return s}static _$Eh(t,i){const s=i.attribute;return !1===s?void 0:"string"==typeof s?s:"string"==typeof t?t.toLowerCase():void 0}o(){var t;this._$Ep=new Promise((t=>this.enableUpdating=t)),this._$AL=new Map,this._$Em(),this.requestUpdate(),null===(t=this.constructor.l)||void 0===t||t.forEach((t=>t(this)));}addController(t){var i,s;(null!==(i=this._$Eg)&&void 0!==i?i:this._$Eg=[]).push(t),void 0!==this.renderRoot&&this.isConnected&&(null===(s=t.hostConnected)||void 0===s||s.call(t));}removeController(t){var i;null===(i=this._$Eg)||void 0===i||i.splice(this._$Eg.indexOf(t)>>>0,1);}_$Em(){this.constructor.elementProperties.forEach(((t,i)=>{this.hasOwnProperty(i)&&(this._$Et.set(i,this[i]),delete this[i]);}));}createRenderRoot(){var t;const s=null!==(t=this.shadowRoot)&&void 0!==t?t:this.attachShadow(this.constructor.shadowRootOptions);return i$3(s,this.constructor.elementStyles),s}connectedCallback(){var t;void 0===this.renderRoot&&(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),null===(t=this._$Eg)||void 0===t||t.forEach((t=>{var i;return null===(i=t.hostConnected)||void 0===i?void 0:i.call(t)}));}enableUpdating(t){}disconnectedCallback(){var t;null===(t=this._$Eg)||void 0===t||t.forEach((t=>{var i;return null===(i=t.hostDisconnected)||void 0===i?void 0:i.call(t)}));}attributeChangedCallback(t,i,s){this._$AK(t,s);}_$ES(t,i,s=l$3){var e,r;const h=this.constructor._$Eh(t,s);if(void 0!==h&&!0===s.reflect){const n=(null!==(r=null===(e=s.converter)||void 0===e?void 0:e.toAttribute)&&void 0!==r?r:o$3.toAttribute)(i,s.type);this._$Ei=t,null==n?this.removeAttribute(h):this.setAttribute(h,n),this._$Ei=null;}}_$AK(t,i){var s,e,r;const h=this.constructor,n=h._$Eu.get(t);if(void 0!==n&&this._$Ei!==n){const t=h.getPropertyOptions(n),l=t.converter,a=null!==(r=null!==(e=null===(s=l)||void 0===s?void 0:s.fromAttribute)&&void 0!==e?e:"function"==typeof l?l:null)&&void 0!==r?r:o$3.fromAttribute;this._$Ei=n,this[n]=a(i,t.type),this._$Ei=null;}}requestUpdate(t,i,s){let e=!0;void 0!==t&&(((s=s||this.constructor.getPropertyOptions(t)).hasChanged||n$3)(this[t],i)?(this._$AL.has(t)||this._$AL.set(t,i),!0===s.reflect&&this._$Ei!==t&&(void 0===this._$E_&&(this._$E_=new Map),this._$E_.set(t,s))):e=!1),!this.isUpdatePending&&e&&(this._$Ep=this._$EC());}async _$EC(){this.isUpdatePending=!0;try{await this._$Ep;}catch(t){Promise.reject(t);}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var t;if(!this.isUpdatePending)return;this.hasUpdated,this._$Et&&(this._$Et.forEach(((t,i)=>this[i]=t)),this._$Et=void 0);let i=!1;const s=this._$AL;try{i=this.shouldUpdate(s),i?(this.willUpdate(s),null===(t=this._$Eg)||void 0===t||t.forEach((t=>{var i;return null===(i=t.hostUpdate)||void 0===i?void 0:i.call(t)})),this.update(s)):this._$EU();}catch(t){throw i=!1,this._$EU(),t}i&&this._$AE(s);}willUpdate(t){}_$AE(t){var i;null===(i=this._$Eg)||void 0===i||i.forEach((t=>{var i;return null===(i=t.hostUpdated)||void 0===i?void 0:i.call(t)})),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t);}_$EU(){this._$AL=new Map,this.isUpdatePending=!1;}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$Ep}shouldUpdate(t){return !0}update(t){void 0!==this._$E_&&(this._$E_.forEach(((t,i)=>this._$ES(i,this[i],t))),this._$E_=void 0),this._$EU();}updated(t){}firstUpdated(t){}}a$2.finalized=!0,a$2.elementProperties=new Map,a$2.elementStyles=[],a$2.shadowRootOptions={mode:"open"},null==h$2||h$2({ReactiveElement:a$2}),(null!==(s$3=globalThis.reactiveElementVersions)&&void 0!==s$3?s$3:globalThis.reactiveElementVersions=[]).push("1.0.2");

/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
var t$1;const i$2=globalThis.trustedTypes,s$2=i$2?i$2.createPolicy("lit-html",{createHTML:t=>t}):void 0,e=`lit$${(Math.random()+"").slice(9)}$`,o$2="?"+e,n$2=`<${o$2}>`,l$2=document,h$1=(t="")=>l$2.createComment(t),r$1=t=>null===t||"object"!=typeof t&&"function"!=typeof t,d$1=Array.isArray,u$1=t=>{var i;return d$1(t)||"function"==typeof(null===(i=t)||void 0===i?void 0:i[Symbol.iterator])},c$1=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,v$1=/-->/g,a$1=/>/g,f$1=/>|[ 	\n\r](?:([^\s"'>=/]+)([ 	\n\r]*=[ 	\n\r]*(?:[^ 	\n\r"'`<>=]|("|')|))|$)/g,_$1=/'/g,m$1=/"/g,g$1=/^(?:script|style|textarea)$/i,$=t=>(i,...s)=>({_$litType$:t,strings:i,values:s}),p$1=$(1),b$1=Symbol.for("lit-noChange"),T=Symbol.for("lit-nothing"),x$1=new WeakMap,w$1=(t,i,s)=>{var e,o;const n=null!==(e=null==s?void 0:s.renderBefore)&&void 0!==e?e:i;let l=n._$litPart$;if(void 0===l){const t=null!==(o=null==s?void 0:s.renderBefore)&&void 0!==o?o:null;n._$litPart$=l=new N$1(i.insertBefore(h$1(),t),t,void 0,null!=s?s:{});}return l._$AI(t),l},A$1=l$2.createTreeWalker(l$2,129,null,!1),C=(t,i)=>{const o=t.length-1,l=[];let h,r=2===i?"<svg>":"",d=c$1;for(let i=0;i<o;i++){const s=t[i];let o,u,$=-1,p=0;for(;p<s.length&&(d.lastIndex=p,u=d.exec(s),null!==u);)p=d.lastIndex,d===c$1?"!--"===u[1]?d=v$1:void 0!==u[1]?d=a$1:void 0!==u[2]?(g$1.test(u[2])&&(h=RegExp("</"+u[2],"g")),d=f$1):void 0!==u[3]&&(d=f$1):d===f$1?">"===u[0]?(d=null!=h?h:c$1,$=-1):void 0===u[1]?$=-2:($=d.lastIndex-u[2].length,o=u[1],d=void 0===u[3]?f$1:'"'===u[3]?m$1:_$1):d===m$1||d===_$1?d=f$1:d===v$1||d===a$1?d=c$1:(d=f$1,h=void 0);const y=d===f$1&&t[i+1].startsWith("/>")?" ":"";r+=d===c$1?s+n$2:$>=0?(l.push(o),s.slice(0,$)+"$lit$"+s.slice($)+e+y):s+e+(-2===$?(l.push(void 0),i):y);}const u=r+(t[o]||"<?>")+(2===i?"</svg>":"");return [void 0!==s$2?s$2.createHTML(u):u,l]};class P$1{constructor({strings:t,_$litType$:s},n){let l;this.parts=[];let r=0,d=0;const u=t.length-1,c=this.parts,[v,a]=C(t,s);if(this.el=P$1.createElement(v,n),A$1.currentNode=this.el.content,2===s){const t=this.el.content,i=t.firstChild;i.remove(),t.append(...i.childNodes);}for(;null!==(l=A$1.nextNode())&&c.length<u;){if(1===l.nodeType){if(l.hasAttributes()){const t=[];for(const i of l.getAttributeNames())if(i.endsWith("$lit$")||i.startsWith(e)){const s=a[d++];if(t.push(i),void 0!==s){const t=l.getAttribute(s.toLowerCase()+"$lit$").split(e),i=/([.?@])?(.*)/.exec(s);c.push({type:1,index:r,name:i[2],strings:t,ctor:"."===i[1]?M$1:"?"===i[1]?H$1:"@"===i[1]?I$1:S$1});}else c.push({type:6,index:r});}for(const i of t)l.removeAttribute(i);}if(g$1.test(l.tagName)){const t=l.textContent.split(e),s=t.length-1;if(s>0){l.textContent=i$2?i$2.emptyScript:"";for(let i=0;i<s;i++)l.append(t[i],h$1()),A$1.nextNode(),c.push({type:2,index:++r});l.append(t[s],h$1());}}}else if(8===l.nodeType)if(l.data===o$2)c.push({type:2,index:r});else {let t=-1;for(;-1!==(t=l.data.indexOf(e,t+1));)c.push({type:7,index:r}),t+=e.length-1;}r++;}}static createElement(t,i){const s=l$2.createElement("template");return s.innerHTML=t,s}}function V(t,i,s=t,e){var o,n,l,h;if(i===b$1)return i;let d=void 0!==e?null===(o=s._$Cl)||void 0===o?void 0:o[e]:s._$Cu;const u=r$1(i)?void 0:i._$litDirective$;return (null==d?void 0:d.constructor)!==u&&(null===(n=null==d?void 0:d._$AO)||void 0===n||n.call(d,!1),void 0===u?d=void 0:(d=new u(t),d._$AT(t,s,e)),void 0!==e?(null!==(l=(h=s)._$Cl)&&void 0!==l?l:h._$Cl=[])[e]=d:s._$Cu=d),void 0!==d&&(i=V(t,d._$AS(t,i.values),d,e)),i}class E$1{constructor(t,i){this.v=[],this._$AN=void 0,this._$AD=t,this._$AM=i;}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}p(t){var i;const{el:{content:s},parts:e}=this._$AD,o=(null!==(i=null==t?void 0:t.creationScope)&&void 0!==i?i:l$2).importNode(s,!0);A$1.currentNode=o;let n=A$1.nextNode(),h=0,r=0,d=e[0];for(;void 0!==d;){if(h===d.index){let i;2===d.type?i=new N$1(n,n.nextSibling,this,t):1===d.type?i=new d.ctor(n,d.name,d.strings,this,t):6===d.type&&(i=new L$1(n,this,t)),this.v.push(i),d=e[++r];}h!==(null==d?void 0:d.index)&&(n=A$1.nextNode(),h++);}return o}m(t){let i=0;for(const s of this.v)void 0!==s&&(void 0!==s.strings?(s._$AI(t,s,i),i+=s.strings.length-2):s._$AI(t[i])),i++;}}class N$1{constructor(t,i,s,e){var o;this.type=2,this._$AH=T,this._$AN=void 0,this._$AA=t,this._$AB=i,this._$AM=s,this.options=e,this._$Cg=null===(o=null==e?void 0:e.isConnected)||void 0===o||o;}get _$AU(){var t,i;return null!==(i=null===(t=this._$AM)||void 0===t?void 0:t._$AU)&&void 0!==i?i:this._$Cg}get parentNode(){let t=this._$AA.parentNode;const i=this._$AM;return void 0!==i&&11===t.nodeType&&(t=i.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,i=this){t=V(this,t,i),r$1(t)?t===T||null==t||""===t?(this._$AH!==T&&this._$AR(),this._$AH=T):t!==this._$AH&&t!==b$1&&this.$(t):void 0!==t._$litType$?this.T(t):void 0!==t.nodeType?this.S(t):u$1(t)?this.M(t):this.$(t);}A(t,i=this._$AB){return this._$AA.parentNode.insertBefore(t,i)}S(t){this._$AH!==t&&(this._$AR(),this._$AH=this.A(t));}$(t){this._$AH!==T&&r$1(this._$AH)?this._$AA.nextSibling.data=t:this.S(l$2.createTextNode(t)),this._$AH=t;}T(t){var i;const{values:s,_$litType$:e}=t,o="number"==typeof e?this._$AC(t):(void 0===e.el&&(e.el=P$1.createElement(e.h,this.options)),e);if((null===(i=this._$AH)||void 0===i?void 0:i._$AD)===o)this._$AH.m(s);else {const t=new E$1(o,this),i=t.p(this.options);t.m(s),this.S(i),this._$AH=t;}}_$AC(t){let i=x$1.get(t.strings);return void 0===i&&x$1.set(t.strings,i=new P$1(t)),i}M(t){d$1(this._$AH)||(this._$AH=[],this._$AR());const i=this._$AH;let s,e=0;for(const o of t)e===i.length?i.push(s=new N$1(this.A(h$1()),this.A(h$1()),this,this.options)):s=i[e],s._$AI(o),e++;e<i.length&&(this._$AR(s&&s._$AB.nextSibling,e),i.length=e);}_$AR(t=this._$AA.nextSibling,i){var s;for(null===(s=this._$AP)||void 0===s||s.call(this,!1,!0,i);t&&t!==this._$AB;){const i=t.nextSibling;t.remove(),t=i;}}setConnected(t){var i;void 0===this._$AM&&(this._$Cg=t,null===(i=this._$AP)||void 0===i||i.call(this,t));}}class S$1{constructor(t,i,s,e,o){this.type=1,this._$AH=T,this._$AN=void 0,this.element=t,this.name=i,this._$AM=e,this.options=o,s.length>2||""!==s[0]||""!==s[1]?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=T;}get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}_$AI(t,i=this,s,e){const o=this.strings;let n=!1;if(void 0===o)t=V(this,t,i,0),n=!r$1(t)||t!==this._$AH&&t!==b$1,n&&(this._$AH=t);else {const e=t;let l,h;for(t=o[0],l=0;l<o.length-1;l++)h=V(this,e[s+l],i,l),h===b$1&&(h=this._$AH[l]),n||(n=!r$1(h)||h!==this._$AH[l]),h===T?t=T:t!==T&&(t+=(null!=h?h:"")+o[l+1]),this._$AH[l]=h;}n&&!e&&this.k(t);}k(t){t===T?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,null!=t?t:"");}}class M$1 extends S$1{constructor(){super(...arguments),this.type=3;}k(t){this.element[this.name]=t===T?void 0:t;}}const k$1=i$2?i$2.emptyScript:"";class H$1 extends S$1{constructor(){super(...arguments),this.type=4;}k(t){t&&t!==T?this.element.setAttribute(this.name,k$1):this.element.removeAttribute(this.name);}}class I$1 extends S$1{constructor(t,i,s,e,o){super(t,i,s,e,o),this.type=5;}_$AI(t,i=this){var s;if((t=null!==(s=V(this,t,i,0))&&void 0!==s?s:T)===b$1)return;const e=this._$AH,o=t===T&&e!==T||t.capture!==e.capture||t.once!==e.once||t.passive!==e.passive,n=t!==T&&(e===T||o);o&&this.element.removeEventListener(this.name,this,e),n&&this.element.addEventListener(this.name,this,t),this._$AH=t;}handleEvent(t){var i,s;"function"==typeof this._$AH?this._$AH.call(null!==(s=null===(i=this.options)||void 0===i?void 0:i.host)&&void 0!==s?s:this.element,t):this._$AH.handleEvent(t);}}class L$1{constructor(t,i,s){this.element=t,this.type=6,this._$AN=void 0,this._$AM=i,this.options=s;}get _$AU(){return this._$AM._$AU}_$AI(t){V(this,t);}}const z$1=window.litHtmlPolyfillSupport;null==z$1||z$1(P$1,N$1),(null!==(t$1=globalThis.litHtmlVersions)&&void 0!==t$1?t$1:globalThis.litHtmlVersions=[]).push("2.0.2");

/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */var l$1,o$1;class s$1 extends a$2{constructor(){super(...arguments),this.renderOptions={host:this},this._$Dt=void 0;}createRenderRoot(){var t,e;const i=super.createRenderRoot();return null!==(t=(e=this.renderOptions).renderBefore)&&void 0!==t||(e.renderBefore=i.firstChild),i}update(t){const i=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Dt=w$1(i,this.renderRoot,this.renderOptions);}connectedCallback(){var t;super.connectedCallback(),null===(t=this._$Dt)||void 0===t||t.setConnected(!0);}disconnectedCallback(){var t;super.disconnectedCallback(),null===(t=this._$Dt)||void 0===t||t.setConnected(!1);}render(){return b$1}}s$1.finalized=!0,s$1._$litElement$=!0,null===(l$1=globalThis.litElementHydrateSupport)||void 0===l$1||l$1.call(globalThis,{LitElement:s$1});const n$1=globalThis.litElementPolyfillSupport;null==n$1||n$1({LitElement:s$1});(null!==(o$1=globalThis.litElementVersions)&&void 0!==o$1?o$1:globalThis.litElementVersions=[]).push("3.0.2");

class pageLoader extends s$1 {
    static styles = r$3`

    .loader-wrapper {
        width: 100%;
        height: 100%;
        position: fixed;
        z-index: 10;
        top: 0;
        left: 0;
        background-color: #242f3f;
        display:flex;
        justify-content: center;
        align-items: center;
    }
    
    .loader {
        display: inline-block;
        z-index: 10;
        width: 50px;
        height: 50px;
        position: relative;
        border: 4px solid #Fff;
        animation: loader 2s infinite ease;
      }
    
      .loader-inner {
        z-index: 10;
        vertical-align: top;
        display: inline-block;
        width: 100%;
        background-color: #Fff;
        animation: loader-inner 2s infinite ease-in;
      }
    
      .emptyP {
          color: #242f3f;
      }
      
      @keyframes loader {
        0% { transform: rotate(0deg);}
        25% { transform: rotate(180deg);}
        50% { transform: rotate(180deg);}
        75% { transform: rotate(360deg);}
        100% { transform: rotate(360deg);}
    }
    
    @keyframes loader-inner {
        0% { height: 0%;}
        25% { height: 0%;}
        50% { height: 100%;}
        75% { height: 100%;}
        100% { height: 0%;}
      }
    `;

    constructor() {
        super();
        window.onload=this.fadeOut;
    }


    fadeOut(){
        var fadeTarget = document.querySelector('page-loader').shadowRoot.querySelector('.loader-wrapper');
        var fadeEffect = setInterval(function () {
            if (!fadeTarget.style.opacity) {
                fadeTarget.style.opacity = 1;
            }
            if (fadeTarget.style.opacity > 0) {
                fadeTarget.style.opacity -= 0.1;
            } else {
                clearInterval(fadeEffect);
                fadeTarget.remove();
            }
        }, 20);
      } 

    render() {
        return p$1`
         <div class="loader-wrapper" id="loader-wrapper">
            <span class="loader"><span class="loader-inner"></span><p class="emptyP">.</p></span>
        </div>
        `;
    }
}

customElements.define('page-loader', pageLoader);

class courseInfoCursuscoordinator extends s$1 {

    static styles = r$3`
    .course-table-section {
        padding-left: 3rem;
        padding-right: 3rem;
    }
    
    .scroll-table {
        overflow:auto;
        overflow-y: scroll;
        height: 60vh;
    }
    
    thead {
        top: 0;
        z-index: 2;
        position: sticky;
     }
    
    .styled-table {
        align-self:flex-start;
        border-collapse: collapse;
        margin: 25px 0;
        font-size: 0.9em;
        font-family: sans-serif;
        min-width: 400px;
        box-shadow: 0 0 20px rgba(0, 0, 0, 0.15);
        margin-top: 0rem;
    }
    
    .styled-table thead tr {
        background-color: #009ad1;
        color: #ffffff;
        text-align: left;
    }
    
    
    .styled-table th,
    .styled-table td {
        padding: 12px 15px;
    }
    
    .styled-table tbody tr {
        border-bottom: 1px solid #dddddd;
    }
    
    .styled-table tbody tr:nth-of-type(even) {
        background-color: #f3f3f3;
    }
    
    .styled-table tbody tr:last-of-type {
        border-bottom: 2px solid #009ad1;
    }

    .modal {
        display: none;
        position: fixed;
        z-index: 3;
    
        padding-top: 100px;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        overflow: auto;
        background-color: rgb(0,0,0);
        background-color: rgba(0,0,0,0.4);
      }
    
      #modal-content {
        background-color: #fefefe;
        margin: auto;
        padding: 20px;
        border: 1px solid #888;
        width: 80%;
        border-radius: 10px;
        animation: appear 201ms ease-in 1;
    
      }
    
      #text-div{
        column-count: 2;
      }
    
    .close:hover,
    .close:focus {
      color: #000;
      text-decoration: none;
      cursor: pointer;
    }
    
    
    .close {
        width: 30px;
        font-size: 20px;
        color: #c0c5cb;
        align-self: flex-end;
        background-color: transparent;
        border: none;
        margin-bottom: 10px;
        float: right;
    }
    
    @keyframes appear {
        0%{
          opacity: 0;
          transform: translateY(-10px);
        }
      }
    `;
 
    constructor() {
        super();
    }

    render() {
        return p$1`
        <div class="course-table-section">
            <course-modal-cursus></course-modal-cursus>
            <course-table></course-table>
        </div>
        `;
    }
}

customElements.define('course-info-cursus', courseInfoCursuscoordinator);

class courseInfoStudent extends s$1 {

    static styles = r$3`
    .course-table-section {
        padding-left: 3rem;
        padding-right: 3rem;
    }
    
    .scroll-table {
        overflow:auto;
        overflow-y: scroll;
        height: 60vh;
    }
    
    thead {
        top: 0;
        z-index: 2;
        position: sticky;
     }
    
    .styled-table {
        align-self:flex-start;
        border-collapse: collapse;
        margin: 25px 0;
        font-size: 0.9em;
        font-family: sans-serif;
        min-width: 400px;
        box-shadow: 0 0 20px rgba(0, 0, 0, 0.15);
        margin-top: 0rem;
    }
    
    .styled-table thead tr {
        background-color: #009ad1;
        color: #ffffff;
        text-align: left;
    }
    
    
    .styled-table th,
    .styled-table td {
        padding: 12px 15px;
    }
    
    .styled-table tbody tr {
        border-bottom: 1px solid #dddddd;
    }
    
    .styled-table tbody tr:nth-of-type(even) {
        background-color: #f3f3f3;
    }
    
    .styled-table tbody tr:last-of-type {
        border-bottom: 2px solid #009ad1;
    }

    .modal {
        display: none;
        position: fixed;
        z-index: 3;
    
        padding-top: 100px;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        overflow: auto;
        background-color: rgb(0,0,0);
        background-color: rgba(0,0,0,0.4);
      }
    
      #modal-content {
        background-color: #fefefe;
        margin: auto;
        padding: 20px;
        border: 1px solid #888;
        width: 80%;
        border-radius: 10px;
        animation: appear 201ms ease-in 1;
    
      }
    
      #text-div{
        column-count: 2;
      }
    
    .close:hover,
    .close:focus {
      color: #000;
      text-decoration: none;
      cursor: pointer;
    }
    
    
    .close {
        width: 30px;
        font-size: 20px;
        color: #c0c5cb;
        align-self: flex-end;
        background-color: transparent;
        border: none;
        margin-bottom: 10px;
        float: right;
    }
    
    @keyframes appear {
        0%{
          opacity: 0;
          transform: translateY(-10px);
        }
      }
    `;
 
    constructor() {
        super();
    }

    render() {
        return p$1`
        <div class="course-table-section">
            <course-modal-student></course-modal-student>
            <course-table></course-table>
        </div>
        `;
    }
}

customElements.define('course-info-student', courseInfoStudent);

class CoursemodalCursuscoordinator extends s$1 {
    static styles = r$3`
    :host{    
      --input-color: #5f6573;
      --input-border: #CDD9ED;
      --input-background: #fff;
      --input-placeholder: #CBD1DC;
  
      --input-border-focus: #275EFE;
  
      --group-color: var(--input-color);
      --group-border: var(--input-border);
      --group-background: #EEF4FF;
  
      --group-color-focus: #fff;
      --group-border-focus: var(--input-border-focus);
      --group-background-focus: #678EFE;
    }

    html {
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
  }
  
  * {
      box-sizing: inherit;
      *:before,
      *:after {
          box-sizing: inherit;
      }
  }

    .modal {
        font-family: 'Mukta Malar', Arial;
        display: none;
        position: fixed;
        z-index: 3;
        padding-top:20px;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        overflow: auto;
        background-color: rgb(0,0,0);
        background-color: rgba(0,0,0,0.4);
      }

      label{
        width:55%;
      }
  
      #modal-content {
        background-color: #fefefe;
        margin: auto;
        padding: 20px;
        border: 1px solid #888;
        min-width: 360px;
        width:600px;
        border-radius: 10px;
        animation: appear 201ms ease-in 1;  
        display:flex;
        flex-direction: column;
      }

      .inputField{
        width: 100%;
        padding: 8px 16px;
        line-height: 25px;
        font-size: 14px;
        font-weight: 500;
        font-family: inherit;
        -webkit-appearance: none;
        color: rgba(0, 0, 0, 0.55);
        border: 1px solid var(--input-border);
        background: var(--input-background);
        transition: border .3s ease;
      }

      .inputField::placeholder {
        color: var(--input-placeholder);
      }

      .inputField:focus {
        outline: none;
        border-color: var(--input-border-focus);
      }

    .editDiv{
      position: relative;
      display: flex;
      margin-left:10px;
      margin-right:10px;
    }

    .editDiv > .inputfield,
    label {
      display: inline-block;
      white-space: nowrap;
      .editDiv > label,
    }


    .inputfield {
        position: relative;
        z-index: 1;
        flex: 1 1 auto;
        width: 1%;
        margin-top: 0;
        margin-bottom: 0;
    }
    
    .editDiv > label {
        text-align: left;
        padding: 8px 12px;
        font-size: 16px;
        line-height: 25px;
        color: var(--group-color);
        background: var(--group-background);
        border: 1px solid var(--group-border);
        transition: background .3s ease, border .3s ease, color .3s ease;
    }


    .editDiv:focus-within > label {
        color: var(--group-color-focus);
        background: var(--group-background-focus);
        border-color: var(--group-border-focus);
      }

  
    .header1{
      margin-top:-5px;
      text-align:center;

      color: #111; 
      font-family: 'Helvetica Neue', sans-serif; font-size: 45px; 
      font-weight: bold; 
      letter-spacing: -1px; 
      line-height: 1; 
      text-align: center;
    }

    #text-div{
      display: inline-block;
      width: 100%;
    }

    .close {
      width: 30px;
      font-size: 20px;
      color: #c0c5cb;
      align-self: flex-end;
      background-color: transparent;
      border: none;
      float: right;
  }
    
    .close:hover,
    .close:focus {
      color: #000;
      text-decoration: none;
      cursor: pointer;
    }

    .buttons {
      margin-top:20px;
      order: 3;
      display: flex;
      justify-content: space-between;
    }

    .cancel {
      order: 4;
      margin-left: 6px;
    }

    .save{
      order: 4;
      margin-right: 14px;
    }

    .button {
      cursor:pointer;
      color:black;
      font-size: 16px;
      display:inline-block;
      border-radius: .4em;
      background: #caedfc;
      border-color:#8fdaff;
    }

    .primary {
      line-height:40px;
      transition:ease-in-out .2s;
      padding: 0 16px;
    }

    .primary:hover{
      box-shadow:2px 2px 5px rgba(0,0,0,0.20), inset 0 0 0 99999px rgba(0,0,0,0.2);
    }

    @keyframes appear {
        0%{
          opacity: 0;
          transform: translateY(-10px);
        }
      }

      .scroll-modal::-webkit-scrollbar-track {
        -webkit-box-shadow: inset 0 0 6px rgba(0,0,0,0.3);
        background-color: #F5F5F5;
        border-radius: 10px;
      }
      
      .scroll-modal::-webkit-scrollbar {
        width: 10px;
        opacity:0;
      }
      
      .scroll-modal::-webkit-scrollbar-thumb {
        border-radius: 10px;
        background-color: #9bb3bd;
      }
      

      @media (max-height: 900px) {

        .scroll-modal { 
          overflow:auto;
          overflow-y: scroll;
          scrollbar-width: thin;
          scrollbar-color: #999 #333;
          height: 700px !important;
        }
    }

    @media (max-height: 750px) {

      .scroll-modal { 
        height: 600px !important;
      }
    }
      @media (max-height: 650px) {

        .scroll-modal { 
          height: 450px !important;
        }
    }

    @media (max-height: 500px) {

      .scroll-modal { 
        height: 350px !important;
      }
  }

  @media (max-height: 400px) {

    .scroll-modal { 
      height: 250px !important;
    }

    `;

  constructor() {
      super();
  }


  render() {
    return p$1`
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
      
        <div tabindex="1" role="alertdialog" aria-labelledby="cursus details" id="myModal" class="modal" @click="${this._closeModalOutside}">            
            <div id="modal-content" role="alertdialog" class="scroll-modal">
                <button tabindex="0" class="close" aria-labelledby="escape knop" id="close-button" @click="${this._hideModal}">✖</button>
                <h1 autofocus tabindex="0" class="header1" id="header1">Cursus Overzicht</h1>     
                <div id="text-div"></div>
                <div class="buttons"> 
                  <button  class="cancel button primary" id="cancel-button" @click="${this._cancel}">Annuleren  <i class="fa fa-ban"></i> </button>
                  <button class="save button primary" id="save-button" @click="${this._saveChanges}">Opslaan <i class="fa fa-save"></i></button>
                </div>
            </div>         
        </div>    
    `;
  }   



_focusAccessable() {
    let shadow = this.shadowRoot;
    const modal = shadow.querySelector('#myModal');
    const firstFocusableElement = shadow.querySelector('button');
    const header = modal.querySelector('.header1');
    const lastFocusableElement = modal.querySelector('.save');
    const annuleren = modal.querySelector('.cancel');
    const inputDiv = modal.querySelector('#text-div').querySelector('.editDiv');
    const lastInput = modal.querySelector('#text-div').lastChild;
    const firstInput = modal.querySelector('#text-div').firstChild;

    document.addEventListener('keydown', function(e) {
        let isTabPressed = e.key === 'Tab' || e.keyCode === 9;

        if (!isTabPressed) {
            return;
        }

        if (e.shiftKey ) { 
            if (shadow.activeElement === firstFocusableElement) {
                lastFocusableElement.focus();
                e.preventDefault();
            }
            if(shadow.activeElement === annuleren) {
              lastInput.focus();
              e.preventDefault();
            }
            if(shadow.activeElement === firstInput) {
              header.focus();
              e.preventDefault();
            }
        } else { 
            if(shadow.activeElement === header) {
              inputDiv.focus();
              e.preventDefault();
            }
            if(shadow.activeElement === lastInput) {
              annuleren.focus();
              e.preventDefault();
            }
            if (shadow.activeElement === lastFocusableElement) { 
                firstFocusableElement.focus();
                e.preventDefault();
            }
        }
    });
}

  
  _closeModalOutside(event) {
    let shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
    var shadowTable = shadowPage.querySelector('course-info-cursus').shadowRoot;  
    var textDiv = shadowTable.querySelector('course-modal-cursus').shadowRoot.querySelector('#text-div');  
    var modalDiv = this.shadowRoot.querySelector('#myModal');
    if (event.target == modalDiv) {
        modalDiv.style.display = "none";
        textDiv.innerHTML = "";
    }
  }

  _hideModal() {
    let shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
    var shadowTable = shadowPage.querySelector('course-info-cursus').shadowRoot;  
    var textDiv = shadowTable.querySelector('course-modal-cursus').shadowRoot.querySelector('#text-div');  
    var modalDiv = this.shadowRoot.querySelector('#myModal');
    modalDiv.style.display = "none";
    textDiv.innerHTML = "";
}

  _saveChanges(){
    this._hideModal();
  }

  _cancel() {
    this._hideModal();
  }

  createAndOpenModal(listOfAttributes, listOfElements, KeyListOfConversions){
    let shadowTable = document.querySelector('cursuscoordinator-page').shadowRoot.querySelector('course-info-cursus').shadowRoot;
    let modalDiv = shadowTable.querySelector('course-modal-cursus').shadowRoot.querySelector('#myModal');
    let divModalContent = shadowTable.querySelector('course-modal-cursus').shadowRoot.querySelector('#modal-content');
    let textDiv = shadowTable.querySelector('course-modal-cursus').shadowRoot.querySelector('#text-div');
    modalDiv.classList.add("showModal");

    listOfAttributes.forEach((element, index) => {
        let inputField = document.createElement('input');
        let label = document.createElement('label');
        let editDiv = document.createElement('div');
        
        inputField.className="inputField";
        label.htmlFor="inputField";
        editDiv.className="editDiv";
        if (element == null || element == "" || element == "Opmerkingen" || element == "Opmerking"){
            element = "-";
        }
        if (listOfElements[KeyListOfConversions[index]] == null){
            listOfElements[KeyListOfConversions[index]] = "Opmerkingen";
        }
        label.innerHTML = listOfElements[KeyListOfConversions[index]] + ": ";
        inputField.value = element;
        editDiv.tabIndex = 0;
        editDiv.appendChild(label);
        editDiv.appendChild(inputField);
        textDiv.appendChild(editDiv);
        
    });
    this._focusAccessable();
    divModalContent.appendChild(textDiv);
    modalDiv.style.display = "block";
    modalDiv.focus();
   
}
}

customElements.define('course-modal-cursus', CoursemodalCursuscoordinator);

class CoursemodalStudent extends s$1 {
    static styles = r$3`
    :host{    
      --input-color: #5f6573;
      --input-border: #CDD9ED;
      --input-background: #fff;
      --input-placeholder: #CBD1DC;
  
      --input-border-focus: #275EFE;
  
      --group-color: var(--input-color);
      --group-border: var(--input-border);
      --group-background: #EEF4FF;
  
      --group-color-focus: #fff;
      --group-border-focus: var(--input-border-focus);
      --group-background-focus: #678EFE;
    }

    html {
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
  }
  
  * {
      box-sizing: inherit;
      *:before,
      *:after {
          box-sizing: inherit;
      }
  }

    .modal {
        font-family: 'Mukta Malar', Arial;
        display: none;
        position: fixed;
        z-index: 3;
        padding-top:20px;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        overflow: auto;
        background-color: rgb(0,0,0);
        background-color: rgba(0,0,0,0.4);
      }

      label{
        width:55%;
      }
  
      #modal-content {
        background-color: #fefefe;
        margin: auto;
        padding: 20px;
        border: 1px solid #888;
        min-width: 360px;
        width:600px;
        border-radius: 10px;
        animation: appear 201ms ease-in 1;  
        display:flex;
        flex-direction: column;
        user-select:text;
        padding-bottom:27px;
      }

      .inputField{
        width: 100%;
        padding: 8px 16px;
        line-height: 25px;
        font-size: 14px;
        font-weight: 500;
        font-family: inherit;
        -webkit-appearance: none;
        color: rgba(0, 0, 0, 0.55);
        border: 1px solid var(--input-border);
        background: var(--input-background);
        transition: border .3s ease;
      }

      .inputField::placeholder {
        color: var(--input-placeholder);
      }

      .inputField:focus {
        outline: none;
        border-color: var(--input-border-focus);
      }

    .editDiv{
      position: relative;
      display: flex;
      margin-left:10px;
      margin-right:10px;
    }

    .editDiv > .inputfield,
    label {
      display: inline-block;
      white-space: nowrap;
      .editDiv > label,
    }


    .inputfield {
        position: relative;
        z-index: 1;
        flex: 1 1 auto;
        width: 1%;
        margin-top: 0;
        margin-bottom: 0;
    }
    
    .editDiv > label {
        text-align: left;
        padding: 8px 12px;
        font-size: 16px;
        line-height: 25px;
        color: var(--group-color);
        background: var(--group-background);
        border: 1px solid var(--group-border);
        transition: background .3s ease, border .3s ease, color .3s ease;
    }


    .editDiv:focus-within > label {
        color: var(--group-color-focus);
        background: var(--group-background-focus);
        border-color: var(--group-border-focus);
      }

  
    .header1{
      margin-top:-5px;
      text-align:center;

      color: #111; 
      font-family: 'Helvetica Neue', sans-serif; font-size: 45px; 
      font-weight: bold; 
      letter-spacing: -1px; 
      line-height: 1; 
      text-align: center;
    }
  

    #text-div{
      display: inline-block;
      width: 100%;
    }

    .close {
      width: 30px;
      font-size: 20px;
      color: #c0c5cb;
      align-self: flex-end;
      background-color: transparent;
      border: none;
      float: right;
  }
    
    .close:hover,
    .close:focus {
      color: #000;
      text-decoration: none;
      cursor: pointer;
    }

    .buttons {
      margin-top:20px;
      order: 3;
      display: flex;
      justify-content: space-between;
    }

    .cancel {
      order: 4;
      margin-left: 6px;
    }

    .save{
      order: 4;
      margin-right: 14px;
    }

    .button {
      cursor:pointer;
      color:black;
      font-size: 16px;
      display:inline-block;
      border-radius: .4em;
      background: rgb(171, 171, 171);
    }

    .primary {
      line-height:40px;
      transition:ease-in-out .2s;
      padding: 0 16px;
    }

    .primary:hover{
      transform:scale(1.02);
      box-shadow:2px 2px 5px rgba(0,0,0,0.20), inset 0 0 0 99999px rgba(0,0,0,0.2);
    }

    .save:before, .cancel:before {
      display: inline-block;
      font-size:1rem;
      padding-right:12px;
      background:none;
      color:#FFF;
    }

    @keyframes appear {
        0%{
          opacity: 0;
          transform: translateY(-10px);
        }
      }

      .scroll-modal::-webkit-scrollbar-track {
        -webkit-box-shadow: inset 0 0 6px rgba(0,0,0,0.3);
        background-color: #F5F5F5;
        border-radius: 10px;
      }
      
      .scroll-modal::-webkit-scrollbar {
        width: 10px;
        opacity:0;
      }
      
      .scroll-modal::-webkit-scrollbar-thumb {
        border-radius: 10px;
        background-color: #9bb3bd;
      }
      

      @media (max-height: 900px) {

        .scroll-modal { 
          overflow-y: scroll;
          scrollbar-width: thin;
          scrollbar-color: #999 #333;
          height: 700px !important;
        }
    }

    @media (max-height: 750px) {

      .scroll-modal { 
        height: 600px !important;
      }
    }
      @media (max-height: 650px) {

        .scroll-modal { 
          height: 450px !important;
        }
    }

    @media (max-height: 500px) {

      .scroll-modal { 
        height: 350px !important;
      }
  }

  @media (max-height: 400px) {

    .scroll-modal { 
      height: 250px !important;
    }
}

    `;

  constructor() {
      super();
  }


  render() {
    return p$1`
        <div tabindex="1" role="alertdialog" aria-labelledby="cursus details" id="myModal" class="modal" @click="${this._closeModalOutside}">            
            <div id="modal-content" role="alertdialog" class="scroll-modal">
                <button tabindex="0" class="close" aria-labelledby="escape knop" id="close-button" @click="${this._hideModal}">✖</button>
                <h1 autofocus tabindex="0" class="header1" id="header1">Cursus Overzicht</h1>     
                <div id="text-div"></div>
            </div>         
        </div>         
    </div>    
    `;
  }   

  _focusAccessable() {
    let shadow = this.shadowRoot;
    const modal = shadow.querySelector('#myModal');
    const firstFocusableElement = shadow.querySelector('button');
    const lastInput = modal.querySelector('#text-div').lastChild;

    document.addEventListener('keydown', function(e) {
        let isTabPressed = e.key === 'Tab' || e.keyCode === 9;

        if (!isTabPressed) {
            return;
        }

        if (e.shiftKey ) { 
            if(shadow.activeElement === firstFocusableElement) {
              lastInput.focus();
              e.preventDefault();
            }
        } else { 
            if(shadow.activeElement === lastInput) {
              firstFocusableElement.focus();
              e.preventDefault();
            }
        }
    });
}

  _closeModalOutside(event) {
    let shadowPage = document.querySelector('student-page').shadowRoot;
    var shadowTable = shadowPage.querySelector('course-info-student').shadowRoot;  
    var textDiv = shadowTable.querySelector('course-modal-student').shadowRoot.querySelector('#text-div');  
    var modalDiv = this.shadowRoot.querySelector('#myModal');
    if (event.target == modalDiv) {
        modalDiv.style.display = "none";
        textDiv.innerHTML = "";
    }
  }

  _hideModal() {
    let shadowPage = document.querySelector('student-page').shadowRoot;
    var shadowTable = shadowPage.querySelector('course-info-student').shadowRoot;  
    var textDiv = shadowTable.querySelector('course-modal-student').shadowRoot.querySelector('#text-div');  
    var modalDiv = this.shadowRoot.querySelector('#myModal');
    modalDiv.style.display = "none";
    textDiv.innerHTML = "";
}

  _saveChanges(){
    this._hideModal();
  }

  _cancel() {
    this._hideModal();
  }

  createAndOpenModal(listOfAttributes, listOfElements, KeyListOfConversions){
    let shadowTable = document.querySelector('student-page').shadowRoot.querySelector('course-info-student').shadowRoot;
    let modalDiv = shadowTable.querySelector('course-modal-student').shadowRoot.querySelector('#myModal');
    let divModalContent = shadowTable.querySelector('course-modal-student').shadowRoot.querySelector('#modal-content');
    let textDiv = shadowTable.querySelector('course-modal-student').shadowRoot.querySelector('#text-div');

    modalDiv.classList.add("showModal");

    listOfAttributes.forEach((element, index) => {
        let inputField = document.createElement('span');
        let label = document.createElement('label');
        let editDiv = document.createElement('div');

        inputField.className="inputField";
        label.htmlFor="inputField";
        editDiv.className="editDiv";
        if (element == null || element == "" || element == "Opmerkingen" || element == "Opmerking"){
            element = "-";
        }
        if (listOfElements[KeyListOfConversions[index]] == null){
            listOfElements[KeyListOfConversions[index]] = "Opmerkingen";
        }
        label.innerHTML = listOfElements[KeyListOfConversions[index]] + ": ";
        inputField.textContent = element;
        editDiv.tabIndex = 0;
        editDiv.appendChild(label);
        editDiv.appendChild(inputField);
        textDiv.appendChild(editDiv);
    });
    this._focusAccessable();
    divModalContent.appendChild(textDiv);
    modalDiv.style.display = "block";
    modalDiv.focus();
}
}

customElements.define('course-modal-student', CoursemodalStudent);

// Unique ID creation requires a high quality random # generator. In the browser we therefore
// require the crypto API and do not support built-in fallback to lower quality random number
// generators (like Math.random()).
var getRandomValues;
var rnds8 = new Uint8Array(16);
function rng() {
  // lazy load so that environments that need to polyfill have a chance to do so
  if (!getRandomValues) {
    // getRandomValues needs to be invoked in a context where "this" is a Crypto implementation. Also,
    // find the complete implementation of crypto (msCrypto) on IE11.
    getRandomValues = typeof crypto !== 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto) || typeof msCrypto !== 'undefined' && typeof msCrypto.getRandomValues === 'function' && msCrypto.getRandomValues.bind(msCrypto);

    if (!getRandomValues) {
      throw new Error('crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported');
    }
  }

  return getRandomValues(rnds8);
}

var REGEX = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;

function validate(uuid) {
  return typeof uuid === 'string' && REGEX.test(uuid);
}

/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */

var byteToHex = [];

for (var i$1 = 0; i$1 < 256; ++i$1) {
  byteToHex.push((i$1 + 0x100).toString(16).substr(1));
}

function stringify$1(arr) {
  var offset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  // Note: Be careful editing this code!  It's been tuned for performance
  // and works in ways you may not expect. See https://github.com/uuidjs/uuid/pull/434
  var uuid = (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase(); // Consistency check for valid UUID.  If this throws, it's likely due to one
  // of the following:
  // - One or more input array values don't map to a hex octet (leading to
  // "undefined" in the uuid)
  // - Invalid input values for the RFC `version` or `variant` fields

  if (!validate(uuid)) {
    throw TypeError('Stringified UUID is invalid');
  }

  return uuid;
}

function v4(options, buf, offset) {
  options = options || {};
  var rnds = options.random || (options.rng || rng)(); // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`

  rnds[6] = rnds[6] & 0x0f | 0x40;
  rnds[8] = rnds[8] & 0x3f | 0x80; // Copy bytes to buffer, if provided

  if (buf) {
    offset = offset || 0;

    for (var i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }

    return buf;
  }

  return stringify$1(rnds);
}

class Conversion {

    constructor(bezemOrConversion, oldCourse, newCourse, comment, sheet) {
        this.id = v4(); // used to generate a unieke identifier
        this.bezemOrConversion = bezemOrConversion;
        this.oldCourse=oldCourse;
        this.newCourse=newCourse;
        this.comment=comment;
        this.sheet =sheet;
    }
}

class Course{

    constructor(education,code,name,period,ecCourse,exams) {
        this.id = v4(); // used to generate a unieke identifier
        this.education=education;
        this.code=code;
        this.name=name;
        this.period=period;
        this.ecCourse=ecCourse;
        this.exams=exams;
    }


}

class Exam {
    constructor(examType,weighting,ecExam,coordinator) {
        this.id = v4(); // used to generate a unieke identifier
        this.examType=examType;
        this.weighting=weighting;
        this.ecExam=ecExam;
        this.coordinator=coordinator;
    }
}

class ConversionService{

    constructor() {
        this.localDB = window.localStorage;
        this.conversie = "";
    }

    saveConversion(conversion) {
        let existingconversion = JSON.parse(this.localDB.getItem('conversions'));
        existingconversion.push(conversion);
        this.conversie = existingconversion;
        this.localDB.setItem('conversions', JSON.stringify(existingconversion));
    }

    saveConversionToLocalStorage(conversion){
        let existingStorage = JSON.parse(this.localDB.getItem('storage'));
        existingStorage[9].push(conversion);
        this.localDB.setItem('storage', JSON.stringify(existingStorage)); //werkt nog niet????
    }

    getConversions(){
        return JSON.parse(this.localDB.getItem('conversions'));
    }




}

class CourseService {

    constructor() {
        this.localDB = window.localStorage;
    }

    saveCourse(course) {
        let existingCourses = JSON.parse(this.localDB.getItem('courses'));  
        existingCourses.push(course); 
        this.localDB.setItem('courses', JSON.stringify(existingCourses));
    }

    getCourses(){
        return JSON.parse(this.localDB.getItem('courses'));
    }

}

// import {Exam} from "../model/Exam";

class ExamService {

    constructor() {
        this.localDB = window.localStorage;
    }

    saveExam(exam) {
        let existingExames = JSON.parse(this.localDB.getItem('exams'));
        existingExames.push(exam);
        this.localDB.setItem('exams', JSON.stringify(existingExames));  
    }

    getExamens(){
        return JSON.parse(this.localDB.getItem('exams'));
    }

}

function generateTableSheet1(data, KeyListOfConversions, tblBody, tblHead, toClass) {
    /* create the services to save the objects. */
    const examService = new ExamService();
    const courseService = new CourseService();
    const conversionService = new ConversionService();

    /* Show different pages. */

    /* if statement so the page will get the right element*/
    let shadowPage = null;
    let shadowTableInfo = null;
    let shadowModal = null;
    if (document.querySelector('student-page') == null) {
        shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
        shadowTableInfo = shadowPage.querySelector('course-info-cursus').shadowRoot;
        shadowModal = shadowTableInfo.querySelector('course-modal-cursus');
    } else {
        shadowPage = document.querySelector('student-page').shadowRoot;
        shadowTableInfo = shadowPage.querySelector('course-info-student').shadowRoot;
        shadowModal = shadowTableInfo.querySelector('course-modal-student');
    }

    /* change the headers of the table if necessary */
    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(0).innerHTML = "Opleiding";
    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(1).innerHTML = "Oude naam";
    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(2).innerHTML = "Oude code";
    /* for loop voor every object in the whole sheet. */
    data.forEach((element, index) => {

        /* delete the wrong lines in the excel file. */
        if (index !== 0 && index != 1 && index !== 19 && index !== 20 && index !== 21){
            /* create a row for every line. */
            let row = document.createElement("tr");
            let cell = document.createElement("td");
            let cellText = document.createTextNode("BM");

            /* this attribute isn't in the excel file, but it should be there, so we have to add it separately. */
            if (index !== 1){
                const cell = document.createElement("td");
                const cellText = document.createTextNode("BM");
                cell.appendChild(cellText);
                row.appendChild(cell);
            }
            let listOfAttributes = [];        
            let oldName;
            let oldCode ;
            let ecCursusOld;
            let toetsOld ;
            let ecToetsOld;
            let wegingOld ;
            let bezemOrConversion;
            let newCode;
            let newName;
            let ecCursusNew;
            let toetsNew;
            let ecToetsNew;
            let periode;
            let coordinator;
            let opmerking;
            let wegingNew;
 
            /* for loop for the object's attributes. */
            for (let indexOfAttribute = 0; indexOfAttribute < 16; indexOfAttribute++) {
                /* filter the data to show in the table. */
                if (toClass || KeyListOfConversions[indexOfAttribute] === "Versie update" || KeyListOfConversions[indexOfAttribute] === "9/6/21" ||
                 KeyListOfConversions[indexOfAttribute] === "__EMPTY_6" || KeyListOfConversions[indexOfAttribute] === "__EMPTY_5" ||
                  KeyListOfConversions[indexOfAttribute] === "__EMPTY_11" || KeyListOfConversions[indexOfAttribute] === "__EMPTY_4"){
                    /* create the right header words. */

                    cell = document.createElement("td");
                    if (!(KeyListOfConversions[indexOfAttribute] in element)){
                        element[KeyListOfConversions[indexOfAttribute]] = data[index-1][KeyListOfConversions[indexOfAttribute]];
                    }
                    if(KeyListOfConversions[indexOfAttribute] === "__EMPTY_5"){
                        cellText = document.createElement("a");  
                        cellText.innerHTML=
                        `<a class="external" href=https://hu.osiris-student.nl/#/inschrijven/cursus/:id target=_blank>${element[KeyListOfConversions[indexOfAttribute]]} ⧉</a>`;  
                    } else {
                        cellText = document.createTextNode(element[KeyListOfConversions[indexOfAttribute]]);
                    }
                    
                    /* to create the objects in the sessionstorage. */
                    switch (indexOfAttribute) {
                        case 0:
                            oldName = cellText;
                            break;
                        case 1:
                            oldCode = cellText;
                            break;
                        case 2:
                            ecCursusOld = cellText;
                            break;
                        case 3:
                            toetsOld = cellText;
                            break;
                        case 4:
                            wegingOld = cellText;
                            break;
                        case 5:
                            ecToetsOld = cellText;
                            break;
                        case 6:
                            bezemOrConversion = cellText;
                            break;
                        case 7: 
                            newCode =  cellText;                                      
                            break;
                        case 8:
                            newName = cellText;
                            break;
                        case 9:
                            ecCursusNew = cellText;
                            break;
                        case 10:
                            toetsNew = cellText;
                            break;
                        case 11:
                            wegingNew = cellText;
                            break;
                        case 12:
                            ecToetsNew = cellText;
                            break;
                        case 13:
                            periode = cellText;
                            break;
                        case 14:
                            coordinator = cellText;
                            break;
                        case 15:
                            opmerking = cellText;
                            break;                    
                    }

                    
                    cell.appendChild(cellText);
                    row.appendChild(cell);
                }
                listOfAttributes.push(element[KeyListOfConversions[indexOfAttribute]]);
            }
            /* create the objects for the session storage. */
            if (toClass && index > 1){ 
                const oldExam = new Exam(toetsOld.data, wegingOld.data, ecToetsOld.data, coordinator.data);
                const newExam = new Exam(toetsNew.data, wegingNew.data, ecToetsNew.data, coordinator.data);
                examService.saveExam(oldExam);
                examService.saveExam(newExam);
                const oldCourse = new Course("BM", oldCode.data, oldName.data, periode.data, ecCursusOld.data, oldExam);
                const newCourse = new Course("BM", newCode.text, newName.data, periode.data, ecCursusNew.data, newExam);
                courseService.saveCourse(oldCourse);
                courseService.saveCourse(newCourse);
                if (opmerking.data === "undefined"){
                    opmerking.data = "";
                }
                const conversion = new Conversion(bezemOrConversion.data, oldCourse, newCourse, opmerking.data, "sheet1");
                conversionService.saveConversion(conversion);
            }

            /* fil the combobox with the options to search. */
            row.addEventListener("click", () => 
            shadowModal.createAndOpenModal(listOfAttributes, data[1], KeyListOfConversions));
            tblBody.appendChild(row); 
        }
    });
}

/* each sheet has circa the same structure, see sheet 1 for the explanation. */
function generateTableSheet2(data, KeyListOfConversions, tblBody, tblHead, toClass) {
    const examService = new ExamService();
    const courseService = new CourseService();
    const conversionService = new ConversionService();
   /* if statement so the page will get the right element*/
   let shadowPage = null;
   let shadowTableInfo = null;
   let shadowModal = null;
   if (document.querySelector('student-page') == null) {
       shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
       shadowTableInfo = shadowPage.querySelector('course-info-cursus').shadowRoot;
       shadowModal = shadowTableInfo.querySelector('course-modal-cursus');
   } else {
       shadowPage = document.querySelector('student-page').shadowRoot;
       shadowTableInfo = shadowPage.querySelector('course-info-student').shadowRoot;
       shadowModal = shadowTableInfo.querySelector('course-modal-student');
   }

    
    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(0).innerHTML = "Oude code";
    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(1).innerHTML = "Opleiding";
    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(2).innerHTML = "Oude naam";
    data.forEach((element, index) => {

        /* delete the wrong lines in the excel file. */
        if (index !== 0 && index != 1 && index !== 24 && index !== 25 && index !== 26 && index !== 27){
            var row = document.createElement("tr");
            /* create a row for every line. */
            let listOfAttributes = [];        
            let oldName;
            let oldCode ;
            let ecCursusOld;
            let toetsOld ;
            let ecToetsOld;
            let wegingOld ;
            let bezemOrConversion;
            let newCode;
            let newName;
            let ecCursusNew;
            let toetsNew;
            let ecToetsNew;
            let periode;
            let coordinator;
            let wegingNew;
            let opleiding;
            let cell;
            let cellText;

            /* for loop for the object's attributes. */
            for (let indexOfAttribute = 0; indexOfAttribute < 16; indexOfAttribute++) {
                if (toClass || KeyListOfConversions[indexOfAttribute] === "Versie update" || KeyListOfConversions[indexOfAttribute] == "9/6/21" 
                || KeyListOfConversions[indexOfAttribute] == "__EMPTY" || KeyListOfConversions[indexOfAttribute] == "__EMPTY_5" 
                || KeyListOfConversions[indexOfAttribute] == "__EMPTY_6" || KeyListOfConversions[indexOfAttribute] == "__EMPTY_7" 
                || KeyListOfConversions[indexOfAttribute] == "__EMPTY_12"){

                        cell = document.createElement("td");
                        if (!(KeyListOfConversions[indexOfAttribute] in element)){
                            element[KeyListOfConversions[indexOfAttribute]] = data[index-1][KeyListOfConversions[indexOfAttribute]];
                        }
                        if(KeyListOfConversions[indexOfAttribute] === "__EMPTY_6"){
                            cellText = document.createElement("a");  
                            cellText.innerHTML=`<a class="external" href=https://hu.osiris-student.nl/#/inschrijven/cursus/:id target=_blank>${element[KeyListOfConversions[indexOfAttribute]]} ⧉</a>`;  
                        } else {
                            cellText = document.createTextNode(element[KeyListOfConversions[indexOfAttribute]]);
                        }                       

                        switch (indexOfAttribute) {
                            case 0:
                                oldCode = cellText;
                                break;
                            case 1:
                                opleiding = cellText;
                                break;
                            case 2:
                                oldName = cellText;
                                break;
                            case 3:
                                ecCursusOld = cellText;
                                break;
                            case 4:
                                toetsOld = cellText;
                                break;
                            case 5:
                                wegingOld = cellText;
                                break;
                            case 6:
                                ecToetsOld = cellText;
                                break;
                            case 7:
                                bezemOrConversion = cellText;
                                break;
                            case 8:
                                newCode = cellText;
                                break;
                            case 9:
                                newName = cellText;
                                break;
                            case 10:
                                ecCursusNew = cellText;
                                break;
                            case 11:
                                toetsNew = cellText;
                                break;
                            case 12:
                                wegingNew = cellText;
                                break;
                            case 13:
                                ecToetsNew = cellText;
                                break;
                            case 14:
                                periode = cellText;
                                break;
                            case 15:
                                coordinator = cellText;
                                break;                        
                    }
                    cell.appendChild(cellText);
                    row.appendChild(cell);
                }
                listOfAttributes.push(element[KeyListOfConversions[indexOfAttribute]]);
            }
            if (toClass && index > 1){
                const oldExam = new Exam(toetsOld.data, wegingOld.data, ecToetsOld.data, coordinator.data);
                const newExam = new Exam(toetsNew.data, wegingNew.data, ecToetsNew.data, coordinator.data);
                examService.saveExam(oldExam);
                examService.saveExam(newExam);
                const oldCourse = new Course(opleiding.data, oldCode.data, oldName.data, periode.data, ecCursusOld.data, oldExam);
                const newCourse = new Course(opleiding.data, newCode.text, newName.data, periode.data, ecCursusNew.data, newExam);
                courseService.saveCourse(oldCourse);
                courseService.saveCourse(newCourse);
                const conversion = new Conversion(bezemOrConversion.data, oldCourse, newCourse, "", "sheet2");
                conversionService.saveConversion(conversion);
            }
            row.addEventListener("click", () => shadowModal.createAndOpenModal(listOfAttributes, data[1], KeyListOfConversions));
            row.tabIndex= 0;
            tblBody.appendChild(row); 
        }
    });  
}

/* each sheet has circa the same structure, see sheet 1 for the explanation. */
function generateTableSheet3(data, KeyListOfConversions, tblBody, tblHead, toClass) {
    const examService = new ExamService();
    const courseService = new CourseService();
    const conversionService = new ConversionService();
   /* if statement so the page will get the right element*/
   let shadowPage = null;
   let shadowTableInfo = null;
   let shadowModal = null;
   if (document.querySelector('student-page') == null) {
       shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
       shadowTableInfo = shadowPage.querySelector('course-info-cursus').shadowRoot;
       shadowModal = shadowTableInfo.querySelector('course-modal-cursus');
   } else {
       shadowPage = document.querySelector('student-page').shadowRoot;
       shadowTableInfo = shadowPage.querySelector('course-info-student').shadowRoot;
       shadowModal = shadowTableInfo.querySelector('course-modal-student');
   }

    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(0).innerHTML = "Oude code";
    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(1).innerHTML = "Opleiding";
    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(2).innerHTML = "Oude naam";
    data.forEach((element, index) => {
        if (index !== 0 && index != 1){
            let row = document.createElement("tr");
            let listOfAttributes = [];        
            let oldName;
            let oldCode ;
            let toetsOld ;
            let ecToetsOld;
            let wegingOld ;
            let bezemOrConversion;
            let newCode;
            let newName;
            let toetsNew;
            let ecToetsNew;
            let periode;
            let coordinator;
            let wegingNew;
            let opleiding;
            let cell;
            let cellText;

            for (let indexOfAttribute = 0; indexOfAttribute < 14; indexOfAttribute++) {

                if (toClass || KeyListOfConversions[indexOfAttribute] === "Versie update" || KeyListOfConversions[indexOfAttribute] === "9/6/21" 
                || KeyListOfConversions[indexOfAttribute] === "__EMPTY" || KeyListOfConversions[indexOfAttribute] === "__EMPTY_5" 
                || KeyListOfConversions[indexOfAttribute] === "__EMPTY_6" || KeyListOfConversions[indexOfAttribute] === "__EMPTY_4" 
                || KeyListOfConversions[indexOfAttribute] === "__EMPTY_10"){
                    
                        cell = document.createElement("td");

                        if (!(KeyListOfConversions[indexOfAttribute] in element)){
                            element[KeyListOfConversions[indexOfAttribute]] = data[index-1][KeyListOfConversions[indexOfAttribute]];
                        }
                        if(KeyListOfConversions[indexOfAttribute] === "__EMPTY_5"){
                            cellText = document.createElement("a");  
                            cellText.innerHTML=`<a class="external" href=https://hu.osiris-student.nl/#/inschrijven/cursus/:id target=_blank>${element[KeyListOfConversions[indexOfAttribute]]} ⧉</a>`;  
                        } else {
                            cellText = document.createTextNode(element[KeyListOfConversions[indexOfAttribute]]);
                        }  
                        
                        switch (indexOfAttribute) {
                            case 0:
                                oldCode = cellText;
                                break;
                            case 1:
                                opleiding = cellText;
                                break;
                            case 2:
                                oldName = cellText;
                                break;
                            case 3:
                                toetsOld = cellText;
                                break;
                            case 4:
                                wegingOld = cellText;
                                break;
                            case 5:
                                ecToetsOld = cellText;
                                break;
                            case 6:
                                bezemOrConversion = cellText;
                                break;
                            case 7:
                                newCode = cellText;
                                break;
                            case 8:
                                newName = cellText;
                                break;
                            case 9:
                                toetsNew = cellText;
                                break;
                            case 10:
                                wegingNew = cellText;
                                break;
                            case 11:
                                ecToetsNew = cellText;
                                break;
                            case 12:
                                periode = cellText;
                                break;
                            case 13:
                                coordinator = cellText;
                                break;
                        
                    }
                    cell.appendChild(cellText);
                    row.appendChild(cell);
                }
                listOfAttributes.push(element[KeyListOfConversions[indexOfAttribute]]);
            }
            if (toClass && index > 1){
                const oldExam = new Exam(toetsOld.data, wegingOld.data, ecToetsOld.data, coordinator.data);
                const newExam = new Exam(toetsNew.data, wegingNew.data, ecToetsNew.data, coordinator.data);
                examService.saveExam(oldExam);
                examService.saveExam(newExam);
                const oldCourse = new Course(opleiding.data, oldCode.data, oldName.data, periode.data, (ecToetsOld.data * 100) / wegingOld.data, oldExam);
                const newCourse = new Course(opleiding.data, newCode.text, newName.data, periode.data, (ecToetsNew.data * 100) / wegingNew.data, newExam);
                courseService.saveCourse(oldCourse);
                courseService.saveCourse(newCourse);
                const conversion = new Conversion(bezemOrConversion.data, oldCourse, newCourse, "", "sheet3");
                conversionService.saveConversion(conversion);
            }
            row.addEventListener("click", () => shadowModal.createAndOpenModal(listOfAttributes, data[1], KeyListOfConversions));
            row.tabIndex= 0;
            tblBody.appendChild(row); 
        }
    });
}

/* each sheet has circa the same structure, see sheet 1 for the explanation. */
function generateTableSheet4(data, KeyListOfConversions, tblBody, tblHead, toClass) {
    const examService = new ExamService();
    const courseService = new CourseService();
    const conversionService = new ConversionService();
   /* if statement so the page will get the right element*/
   let shadowPage = null;
   let shadowTableInfo = null;
   let shadowModal = null;
   if (document.querySelector('student-page') == null) {
       shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
       shadowTableInfo = shadowPage.querySelector('course-info-cursus').shadowRoot;
       shadowModal = shadowTableInfo.querySelector('course-modal-cursus');
   } else {
       shadowPage = document.querySelector('student-page').shadowRoot;
       shadowTableInfo = shadowPage.querySelector('course-info-student').shadowRoot;
       shadowModal = shadowTableInfo.querySelector('course-modal-student');
   }

    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(0).innerHTML = "Oude code";
    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(1).innerHTML = "Opleiding";
    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(2).innerHTML = "Oude naam";
    data.forEach((element, index) => {
        let listOfAttributes = [];        
        let oldName;
        let oldCode ;
        let toetsOld ;
        let ecToetsOld;
        let wegingOld ;
        let bezemOrConversion;
        let newCode;
        let newName;
        let toetsNew;
        let ecToetsNew;
        let ecCursusOld;
        let ecCursusNew;
        let periode;
        let coordinator;
        let wegingNew;
        let opleiding;
        let cell;
        let cellText;

        if (index !== 0 && index != 1 && index !== 42 && index !== 43 && index !== 44){
            var row = document.createElement("tr");
            for (let indexOfAttribute = 0; indexOfAttribute < 17; indexOfAttribute++) {
                if (toClass || KeyListOfConversions[indexOfAttribute] === "Versie update" || KeyListOfConversions[indexOfAttribute] === "9/6/21" 
                || KeyListOfConversions[indexOfAttribute] === "__EMPTY" || KeyListOfConversions[indexOfAttribute] === "__EMPTY_5" 
                || KeyListOfConversions[indexOfAttribute] === "__EMPTY_6" || KeyListOfConversions[indexOfAttribute] === "__EMPTY_7" 
                || KeyListOfConversions[indexOfAttribute] === "__EMPTY_12"){
                    cell = document.createElement("td");

                    if (!(KeyListOfConversions[indexOfAttribute] in element)){
                        element[KeyListOfConversions[indexOfAttribute]] = data[index-1][KeyListOfConversions[indexOfAttribute]];
                    }
                    if(KeyListOfConversions[indexOfAttribute] === "__EMPTY_6"){
                        cellText = document.createElement("a");  
                        cellText.innerHTML=`<a class="external" href=https://hu.osiris-student.nl/#/inschrijven/cursus/:id target=_blank>${element[KeyListOfConversions[indexOfAttribute]]} ⧉</a>`;  
                    } else {
                        cellText = document.createTextNode(element[KeyListOfConversions[indexOfAttribute]]);
                    }  

                        switch (indexOfAttribute) {
                            case 0:
                                oldCode = cellText;
                                break;
                            case 1:
                                opleiding = cellText;
                                break;
                            case 2:
                                oldName = cellText;
                                break;
                            case 3:
                                ecCursusOld = cellText;
                                break;
                            case 4:
                                toetsOld = cellText;
                                break;
                            case 5:
                                wegingOld = cellText;
                                break;
                            case 6:
                                ecToetsOld = cellText;
                                break;
                            case 7:
                                bezemOrConversion = cellText;
                                break;
                            case 8:
                                newCode = cellText;
                                break;
                            case 9:
                                newName = cellText;
                                break;
                            case 10:
                                ecCursusNew = cellText;
                                break;
                            case 11:
                                toetsNew = cellText;
                                break;
                            case 12:
                                wegingNew = cellText;
                                break;
                            case 13:
                                ecToetsNew = cellText;
                                break;
                            case 14:
                                periode = cellText;
                                break;
                            case 15:
                                coordinator = cellText;
                                break;
                        
                    }
                    cell.appendChild(cellText);
                    row.appendChild(cell);
                }
                listOfAttributes.push(element[KeyListOfConversions[indexOfAttribute]]);
            }
            if (toClass && index > 1){
                const oldExam = new Exam(toetsOld.data, wegingOld.data, ecToetsOld.data, coordinator.data);
                const newExam = new Exam(toetsNew.data, wegingNew.data, ecToetsNew.data, coordinator.data);
                examService.saveExam(oldExam);
                examService.saveExam(newExam);
                const oldCourse = new Course(opleiding.data, oldCode.data, oldName.data, periode.data, ecCursusOld.data, oldExam);
                const newCourse = new Course(opleiding.data, newCode.text, newName.data, periode.data, ecCursusNew.data, newExam);
                courseService.saveCourse(oldCourse);
                courseService.saveCourse(newCourse);
                const conversion = new Conversion(bezemOrConversion.data, oldCourse, newCourse, "", "sheet4");
                conversionService.saveConversion(conversion);
            }
            row.addEventListener("click", () => shadowModal.createAndOpenModal(listOfAttributes, data[1], KeyListOfConversions));
            row.tabIndex= 0;
            tblBody.appendChild(row); 
        }
    });
}

/* each sheet has circa the same structure, see sheet 1 for the explanation. */
function generateTableSheet5(data, KeyListOfConversions, tblBody, tblHead, toClass) {
    const examService = new ExamService();
    const courseService = new CourseService();
    const conversionService = new ConversionService();
   /* if statement so the page will get the right element*/
   let shadowPage = null;
   let shadowTableInfo = null;
   let shadowModal = null;
   if (document.querySelector('student-page') == null) {
       shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
       shadowTableInfo = shadowPage.querySelector('course-info-cursus').shadowRoot;
       shadowModal = shadowTableInfo.querySelector('course-modal-cursus');
   } else {
       shadowPage = document.querySelector('student-page').shadowRoot;
       shadowTableInfo = shadowPage.querySelector('course-info-student').shadowRoot;
       shadowModal = shadowTableInfo.querySelector('course-modal-student');
   }

    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(0).innerHTML = "Oude code";
    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(1).innerHTML = "Opleiding";
    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(2).innerHTML = "Oude naam";
    data.forEach((element, index) => {        
        if (index !== 0 && index !== 1 && index !== 55 && index !== 56){
            let row = document.createElement("tr");
            let listOfAttributes = [];        
            let oldName;
            let oldCode ;
            let toetsOld ;
            let ecToetsOld;
            let wegingOld ;
            let bezemOrConversion;
            let newCode;
            let newName;
            let toetsNew;
            let ecToetsNew;
            let ecCursusOld;
            let ecCursusNew;
            let periode;
            let coordinator;
            let wegingNew;
            let opleiding;
            let cell;
            let cellText;

            if (index === 55){
                row = document.createElement("tr");
                cell = document.createElement("th"); 
                cellText = document.createTextNode(element[KeyListOfConversions[1]]);
                cell.appendChild(cellText);
                row.appendChild(cell);
                tblBody.appendChild(row);
            }

            for (let indexOfAttribute = 0; indexOfAttribute < 17; indexOfAttribute++) {
                if (toClass || KeyListOfConversions[indexOfAttribute] === "Versie update" || KeyListOfConversions[indexOfAttribute] === "9/6/21" 
                || KeyListOfConversions[indexOfAttribute] === "__EMPTY" || KeyListOfConversions[indexOfAttribute] === "__EMPTY_5" 
                || KeyListOfConversions[indexOfAttribute] === "__EMPTY_6" || KeyListOfConversions[indexOfAttribute] === "__EMPTY_7" 
                || KeyListOfConversions[indexOfAttribute] === "__EMPTY_12"){
                    cell = document.createElement("td");

                    if (!(KeyListOfConversions[indexOfAttribute] in element)){
                        element[KeyListOfConversions[indexOfAttribute]] = data[index-1][KeyListOfConversions[indexOfAttribute]];
                    }
                    if(KeyListOfConversions[indexOfAttribute] === "__EMPTY_6"){
                        cellText = document.createElement("a");  
                        cellText.innerHTML=`<a class="external" href=https://hu.osiris-student.nl/#/inschrijven/cursus/:id target=_blank>${element[KeyListOfConversions[indexOfAttribute]]} ⧉</a>`;  
                    } else {
                        cellText = document.createTextNode(element[KeyListOfConversions[indexOfAttribute]]);
                    } 

                        switch (indexOfAttribute) {
                            case 0:
                                oldCode = cellText;
                                break;
                            case 1:
                                opleiding = cellText;
                                break;
                            case 2:
                                oldName = cellText;
                                break;
                            case 3:
                                ecCursusOld = cellText;
                                break;
                            case 4:
                                toetsOld = cellText;
                                break;
                            case 5:
                                wegingOld = cellText;
                                break;
                            case 6:
                                ecToetsOld = cellText;
                                break;
                            case 7:
                                bezemOrConversion = cellText;
                                break;
                            case 8:
                                newCode = cellText;
                                break;
                            case 9:
                                newName = cellText;
                                break;
                            case 10:
                                ecCursusNew = cellText;
                                break;
                            case 11:
                                toetsNew = cellText;
                                break;
                            case 12:
                                wegingNew = cellText;
                                break;
                            case 13:
                                ecToetsNew = cellText;
                                break;
                            case 14:
                                periode = cellText;
                                break;
                            case 15:
                                coordinator = cellText;
                                break;
                        
                    }
                    cell.appendChild(cellText);
                    row.appendChild(cell);
                }
                listOfAttributes.push(element[KeyListOfConversions[indexOfAttribute]]);
            }
            if (toClass && index > 1){
                const oldExam = new Exam(toetsOld.data, wegingOld.data, ecToetsOld.data, coordinator.data);
                const newExam = new Exam(toetsNew.data, wegingNew.data, ecToetsNew.data, coordinator.data);
                examService.saveExam(oldExam);
                examService.saveExam(newExam);
                const oldCourse = new Course(opleiding.data, oldCode.data, oldName.data, periode.data, ecCursusOld.data, oldExam);
                const newCourse = new Course(opleiding.data, newCode.text, newName.data, periode.data, ecCursusNew.data, newExam);
                courseService.saveCourse(oldCourse);
                courseService.saveCourse(newCourse);
                const conversion = new Conversion(bezemOrConversion.data, oldCourse, newCourse, "", "sheet5");
                conversionService.saveConversion(conversion);
            }
            row.addEventListener("click", () => shadowModal.createAndOpenModal(listOfAttributes, data[1], KeyListOfConversions));
            row.tabIndex= 0;
            tblBody.appendChild(row); 
        }
    });
}

/* each sheet has circa the same structure, see sheet 1 for the explanation. */
function generateTableSheet6and8(data, KeyListOfConversions, tblBody, tblHead, toClass) {
    const examService = new ExamService();
    const courseService = new CourseService();
    const conversionService = new ConversionService();
   /* if statement so the page will get the right element*/
   let shadowPage = null;
   let shadowTableInfo = null;
   let shadowModal = null;
   if (document.querySelector('student-page') == null) {
       shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
       shadowTableInfo = shadowPage.querySelector('course-info-cursus').shadowRoot;
       shadowModal = shadowTableInfo.querySelector('course-modal-cursus');
   } else {
       shadowPage = document.querySelector('student-page').shadowRoot;
       shadowTableInfo = shadowPage.querySelector('course-info-student').shadowRoot;
       shadowModal = shadowTableInfo.querySelector('course-modal-student');
   }

    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(0).innerHTML = "Oude code";
    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(1).innerHTML = "Opleiding";
    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(2).innerHTML = "Oude naam";
    data.forEach((element, index) => {
        if (index !== 0 && index != 1){
            let row = document.createElement("tr");
            let listOfAttributes = [];        
            let oldName;
            let oldCode ;
            let toetsOld ;
            let ecToetsOld;
            let wegingOld ;
            let bezemOrConversion;
            let newCode;
            let newName;
            let toetsNew;
            let ecToetsNew;
            let ecCursusOld;
            let ecCursusNew;
            let periode;
            let coordinator;
            let wegingNew;
            let opleiding;
            let opmerking;
            let cell;
            let cellText;


            for (let indexOfAttribute = 0; indexOfAttribute < 17; indexOfAttribute++) {
                if (toClass || KeyListOfConversions[indexOfAttribute] === "Versie update" || KeyListOfConversions[indexOfAttribute] === "9/6/21"  || KeyListOfConversions[indexOfAttribute] === "6/18/21" 
                || KeyListOfConversions[indexOfAttribute] === "__EMPTY" || KeyListOfConversions[indexOfAttribute] === "__EMPTY_5" 
                || KeyListOfConversions[indexOfAttribute] === "__EMPTY_6" || KeyListOfConversions[indexOfAttribute] === "__EMPTY_7" 
                || KeyListOfConversions[indexOfAttribute] === "__EMPTY_12"){
                    
                    cell = document.createElement("td");

                    if (!(KeyListOfConversions[indexOfAttribute] in element)){
                        element[KeyListOfConversions[indexOfAttribute]] = data[index-1][KeyListOfConversions[indexOfAttribute]];
                    }
                    if(KeyListOfConversions[indexOfAttribute] === "__EMPTY_6"){
                        cellText = document.createElement("a");  
                        cellText.innerHTML=`<a class="external" href=https://hu.osiris-student.nl/#/inschrijven/cursus/:id target=_blank>${element[KeyListOfConversions[indexOfAttribute]]} ⧉</a>`;  
                    } else {
                        cellText = document.createTextNode(element[KeyListOfConversions[indexOfAttribute]]);
                    } 

                        switch (indexOfAttribute) {
                            case 0:
                                oldCode = cellText;
                                break;
                            case 1:
                                opleiding = cellText;
                                break;
                            case 2:
                                oldName = cellText;
                                break;
                            case 3:
                                ecCursusOld = cellText;
                                break;
                            case 4:
                                toetsOld = cellText;
                                break;
                            case 5:
                                wegingOld = cellText;
                                break;
                            case 6:
                                ecToetsOld = cellText;
                                break;
                            case 7:
                                bezemOrConversion = cellText;
                                break;
                            case 8:
                                newCode = cellText;
                                break;
                            case 9:
                                newName = cellText;
                                break;
                            case 10:
                                ecCursusNew = cellText;
                                break;
                            case 11:
                                toetsNew = cellText;
                                break;
                            case 12:
                                wegingNew = cellText;
                                break;
                            case 13:
                                ecToetsNew = cellText;
                                break;
                            case 14:
                                periode = cellText;
                                break;
                            case 15:
                                coordinator = cellText;
                                break;
                            case 16:
                                opmerking= cellText;
                                break;
                        
                    }
                    cell.appendChild(cellText);
                    row.appendChild(cell);
                }
                listOfAttributes.push(element[KeyListOfConversions[indexOfAttribute]]);
            }
            if (toClass && index > 1){
                const oldExam = new Exam(toetsOld.data, wegingOld.data, ecToetsOld.data, coordinator.data);
                const newExam = new Exam(toetsNew.data, wegingNew.data, ecToetsNew.data, coordinator.data);
                examService.saveExam(oldExam);
                examService.saveExam(newExam);
                const oldCourse = new Course(opleiding.data, oldCode.data, oldName.data, periode.data, ecCursusOld.data, oldExam);
                const newCourse = new Course(opleiding.data, newCode.text, newName.data, periode.data, ecCursusNew.data, newExam);
                courseService.saveCourse(oldCourse);
                courseService.saveCourse(newCourse);
                if (data[0]["Versie update"] === "Bezem & Conversie Hoofdfase BDK  studiejaar 2021-2022"){
                    //sheet 6
                    const conversion = new Conversion(bezemOrConversion.data, oldCourse, newCourse, opmerking.data, "sheet6");
                    conversionService.saveConversion(conversion);
                }else {
                    //sheet 8
                    const conversion = new Conversion(bezemOrConversion.data, oldCourse, newCourse, opmerking.data, "sheet8");
                    conversionService.saveConversion(conversion);
                }

            }
            row.addEventListener("click", () => shadowModal.createAndOpenModal(listOfAttributes, data[1], KeyListOfConversions));
            row.tabIndex= 0;
            tblBody.appendChild(row); 
        }
    });
}

/* each sheet has circa the same structure, see sheet 1 for the explanation. */
function generateTableSheet7(data, KeyListOfConversions, tblBody, tblHead, toClass) {
    const examService = new ExamService();
    const courseService = new CourseService();
    const conversionService = new ConversionService();
   /* if statement so the page will get the right element*/
   let shadowPage = null;
   let shadowTableInfo = null;
   let shadowModal = null;
   if (document.querySelector('student-page') == null) {
       shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
       shadowTableInfo = shadowPage.querySelector('course-info-cursus').shadowRoot;
       shadowModal = shadowTableInfo.querySelector('course-modal-cursus');
   } else {
       shadowPage = document.querySelector('student-page').shadowRoot;
       shadowTableInfo = shadowPage.querySelector('course-info-student').shadowRoot;
       shadowModal = shadowTableInfo.querySelector('course-modal-student');
   }

    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(0).innerHTML = "Oude code";
    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(1).innerHTML = "Opleiding";
    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(2).innerHTML = "Oude naam";
    data.forEach((element, index) => {
        if (index !== 0 && index != 1){
            let row = document.createElement("tr");
            let listOfAttributes = [];        
            let oldName;
            let oldCode ;
            let toetsOld ;
            let ecToetsOld;
            let wegingOld ;
            let bezemOrConversion;
            let newCode;
            let newName;
            let toetsNew;
            let ecToetsNew;
            let ecCursusOld;
            let ecCursusNew;
            let periode;
            let coordinator;
            let wegingNew;
            let opleiding;
            let opmerking;
            let cell;
            let cellText;

            for (let indexOfAttribute = 0; indexOfAttribute < 17; indexOfAttribute++) {
                if (toClass || KeyListOfConversions[indexOfAttribute] === "Versie update" || KeyListOfConversions[indexOfAttribute] === "9/6/21" 
                || KeyListOfConversions[indexOfAttribute] === "__EMPTY" || KeyListOfConversions[indexOfAttribute] === "__EMPTY_5" 
                || KeyListOfConversions[indexOfAttribute] === "__EMPTY_6" || KeyListOfConversions[indexOfAttribute] === "__EMPTY_7" 
                || KeyListOfConversions[indexOfAttribute] === "__EMPTY_12"){
                    cell = document.createElement("td");

                    if (!(KeyListOfConversions[indexOfAttribute] in element)){
                        element[KeyListOfConversions[indexOfAttribute]] = data[index-1][KeyListOfConversions[indexOfAttribute]];
                    }
                    if(KeyListOfConversions[indexOfAttribute] === "__EMPTY_6"){
                        cellText = document.createElement("a");  
                        cellText.innerHTML=`<a class="external" href=https://hu.osiris-student.nl/#/inschrijven/cursus/:id target=_blank>${element[KeyListOfConversions[indexOfAttribute]]} ⧉</a>`;  
                    } else {
                        cellText = document.createTextNode(element[KeyListOfConversions[indexOfAttribute]]);
                    } 

                        switch (indexOfAttribute) {
                            case 0:
                                oldCode = cellText;
                                break;
                            case 1:
                                opleiding = cellText;
                                break;
                            case 2:
                                oldName = cellText;
                                break;
                            case 3:
                                ecCursusOld = cellText;
                                break;
                            case 4:
                                toetsOld = cellText;
                                break;
                            case 5:
                                wegingOld = cellText;
                                break;
                            case 6:
                                ecToetsOld = cellText;
                                break;
                            case 7:
                                bezemOrConversion = cellText;
                                break;
                            case 8:
                                newCode = cellText;
                                break;
                            case 9:
                                newName = cellText;
                                break;
                            case 10:
                                ecCursusNew = cellText;
                                break;
                            case 11:
                                toetsNew = cellText;
                                break;
                            case 12:
                                wegingNew = cellText;
                                break;
                            case 13:
                                ecToetsNew = cellText;
                                break;
                            case 14:
                                periode = cellText;
                                break;
                            case 15:
                                coordinator = cellText;
                                break;
                            case 16:
                                opmerking= cellText;
                                break;
                        
                    }
                    cell.appendChild(cellText);
                    row.appendChild(cell);
                }
                if (index >= 20 && indexOfAttribute >= 10){
                    listOfAttributes.push("");
                }else {
                    listOfAttributes.push(element[KeyListOfConversions[indexOfAttribute]]);
                }
            }
            if (toClass && index > 1){
                const oldExam = new Exam(toetsOld.data, wegingOld.data, ecToetsOld.data, coordinator.data);
                const newExam = new Exam(toetsNew.data, wegingNew.data, ecToetsNew.data, coordinator.data);
                examService.saveExam(oldExam);
                examService.saveExam(newExam);
                const oldCourse = new Course(opleiding.data, oldCode.data, oldName.data, periode.data, ecCursusOld.data, oldExam);
                const newCourse = new Course(opleiding.data, newCode.text, newName.data, periode.data, ecCursusNew.data, newExam);
                courseService.saveCourse(oldCourse);
                courseService.saveCourse(newCourse);
                const conversion = new Conversion(bezemOrConversion.data, oldCourse, newCourse, opmerking.data, "sheet7");
                conversionService.saveConversion(conversion);
            }
            row.addEventListener("click", () => shadowModal.createAndOpenModal(listOfAttributes, data[1], KeyListOfConversions));
            row.tabIndex= 0;
            tblBody.appendChild(row); 
        }
    });
}

/* each sheet has circa the same structure, see sheet 1 for the explanation. */
function generateTableSheet9(data, KeyListOfConversions, tblBody, tblHead, toClass) {
    const examService = new ExamService();
    const courseService = new CourseService();
    const conversionService = new ConversionService();
   /* if statement so the page will get the right element*/
   let shadowPage = null;
   let shadowTableInfo = null;
   let shadowModal = null;
   if (document.querySelector('student-page') == null) {
       shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
       shadowTableInfo = shadowPage.querySelector('course-info-cursus').shadowRoot;
       shadowModal = shadowTableInfo.querySelector('course-modal-cursus');
   } else {
       shadowPage = document.querySelector('student-page').shadowRoot;
       shadowTableInfo = shadowPage.querySelector('course-info-student').shadowRoot;
       shadowModal = shadowTableInfo.querySelector('course-modal-student');
   }

    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(0).innerHTML = "Oude code";
    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(1).innerHTML = "Opleiding";
    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(2).innerHTML = "Oude naam";
    data.forEach((element, index) => {
        if (index !== 0 && index != 1){
            let row = document.createElement("tr");
            let listOfAttributes = [];        
            let oldName;
            let oldCode ;
            let toetsOld ;
            let ecToetsOld;
            let wegingOld ;
            let bezemOrConversion;
            let newCode;
            let newName;
            let toetsNew;
            let ecToetsNew;
            let ecCursusOld;
            let ecCursusNew;
            let periode;
            let coordinator;
            let wegingNew;
            let opleiding;
            let opmerking;
            let cell;
            let cellText;

            for (let indexOfAttribute = 0; indexOfAttribute < 17; indexOfAttribute++) {
                if (toClass || KeyListOfConversions[indexOfAttribute] === "Versie update" || KeyListOfConversions[indexOfAttribute] === "6/18/21" 
                || KeyListOfConversions[indexOfAttribute] === "__EMPTY" || KeyListOfConversions[indexOfAttribute] === "__EMPTY_5" 
                || KeyListOfConversions[indexOfAttribute] === "__EMPTY_6" || KeyListOfConversions[indexOfAttribute] === "__EMPTY_7" 
                || KeyListOfConversions[indexOfAttribute] === "__EMPTY_12"){
                    
                    cell = document.createElement("td");

                    if (!(KeyListOfConversions[indexOfAttribute] in element)){
                        element[KeyListOfConversions[indexOfAttribute]] = data[index-1][KeyListOfConversions[indexOfAttribute]];
                    }
                    if(KeyListOfConversions[indexOfAttribute] === "__EMPTY_6"){
                        cellText = document.createElement("a");  
                        cellText.innerHTML=`<a class="external" href=https://hu.osiris-student.nl/#/inschrijven/cursus/:id target=_blank>${element[KeyListOfConversions[indexOfAttribute]]} ⧉</a>`;  
                    } else {
                        cellText = document.createTextNode(element[KeyListOfConversions[indexOfAttribute]]);
                    } 
                        switch (indexOfAttribute) {
                            case 0:
                                oldCode = cellText;
                                break;
                            case 1:
                                opleiding = cellText;
                                break;
                            case 2:
                                oldName = cellText;
                                break;
                            case 3:
                                ecCursusOld = cellText;
                                break;
                            case 4:
                                toetsOld = cellText;
                                break;
                            case 5:
                                wegingOld = cellText;
                                break;
                            case 6:
                                ecToetsOld = cellText;
                                break;
                            case 7:
                                bezemOrConversion = cellText;
                                break;
                            case 8:
                                newCode = cellText;
                                break;
                            case 9:
                                newName = cellText;
                                break;
                            case 10:
                                ecCursusNew = cellText;
                                break;
                            case 11:
                                toetsNew = cellText;
                                break;
                            case 12:
                                wegingNew = cellText;
                                break;
                            case 13:
                                ecToetsNew = cellText;
                                break;
                            case 14:
                                periode = cellText;
                                break;
                            case 15:
                                coordinator = cellText;
                                break;
                            case 16:
                                opmerking = cellText;
                                break;
                        
                    }
                    cell.appendChild(cellText);
                    row.appendChild(cell);
                }
                listOfAttributes.push(element[KeyListOfConversions[indexOfAttribute]]);
            }
            if (toClass && index > 1){
                const oldExam = new Exam(toetsOld.data, wegingOld.data, ecToetsOld.data, coordinator.data);
                const newExam = new Exam(toetsNew.data, wegingNew.data, ecToetsNew.data, coordinator.data);
                examService.saveExam(oldExam);
                examService.saveExam(newExam);
                const oldCourse = new Course(opleiding.data, oldCode.data, oldName.data, periode.data, ecCursusOld.data, oldExam);
                const newCourse = new Course(opleiding.data, newCode.text, newName.data, periode.data, ecCursusNew.data, newExam);
                courseService.saveCourse(oldCourse);
                courseService.saveCourse(newCourse);
                const conversion = new Conversion(bezemOrConversion.data, oldCourse, newCourse, opmerking.data, "sheet9");
                conversionService.saveConversion(conversion);
            }
            row.addEventListener("click", () => shadowModal.createAndOpenModal(listOfAttributes, data[1], KeyListOfConversions));
            row.tabIndex= 0;
            tblBody.appendChild(row);
        }
    });
}

class StorageService {

    constructor() {
        this.localDB = window.localStorage;
        this.storage;
    }

    saveDatabase(data) {
        this.storage = data;
        this.localDB.setItem('storage', JSON.stringify(data));
    }

    getStorage(){
        return JSON.parse(this.localDB.getItem('storage'));
    }

    addExtraSheet(){
        console.log(this.storage);
        this.storage.push([]);
        this.localDB.setItem('storage', JSON.stringify(this.storage));
    }

}

class Coursetable extends s$1 {
    static styles = r$3`

    .course-table-section {
        padding-left: 3rem;
        padding-right: 3rem;
    }

    a:link {
        text-decoration: none;
    }
    
    .scroll-table {
        overflow:auto;
        overflow-y: scroll;
        height: 60vh;
        overflow-x: scroll; 
    }
    
    thead {
        top: 0;
        z-index: 2;
        position: sticky;
    }

    thead th {
        cursor: pointer;
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        -khtml-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
    }

    thead th:active {
        opacity: 0.6;
    }
    thead th:hover {
        background-color:#0489ba;
    }

    .styled-table tr:hover td,
    .styled-table tr:active td{
        background-color:#d9d9d9;
    }
    
    .styled-table {
        table-layout="fixed";
        align-self:flex-start;
        border-collapse: collapse;
        margin: 25px 0;
        font-size: 0.9em;
        font-family: sans-serif;
        width: 100%;
        box-shadow: 0 0 20px rgba(0, 0, 0, 0.15);
        margin-top: 0rem;
    }
    
    .styled-table thead tr {
        background-color: #009ad1;
        color: #ffffff;
        text-align: left;
    }
    
    
    .styled-table th,
    .styled-table td {
        padding: 12px 15px;
    }
    
    .styled-table tbody tr {
        border-bottom: 1px solid #dddddd;
    }
    
    .styled-table tbody tr:nth-of-type(even) {
        background-color: #f3f3f3;
    }
    
    .styled-table tbody tr:last-of-type {
        border-bottom: 2px solid #009ad1;
    }
      
    .styled-table .th-sort-asc::after {
        content: "▲";
    }
      
    .styled-table .th-sort-desc::after {
        content: "▼";
    }
      
    .styled-table .th-sort-asc::after,
    .styled-table .th-sort-desc::after {
        margin-left: 15px;
    }
      
    .styled-table .th-sort-asc,
    .styled-table .th-sort-desc {
        background: rgba(0, 0, 0, 0.1);
    }


    @media (max-width: 1200px) {

        .scroll-table { 
            width: 1100px !important;
        }
    
        th, td {min-width: 200px; }
    }

    @media (max-width: 1100px) {

        .scroll-table { 
            width: 1000px !important;
        }
    
        th, td {min-width: 200px; }
    }

    @media (max-width: 1000px) {

        .scroll-table { 
            width: 900px !important;
        }
    
        th, td {min-width: 200px; }
    }

    @media (max-width: 900px) {

        .scroll-table { 
            width: 800px !important;
        }
    
        th, td {min-width: 200px; }
    }

    @media (max-width: 800px) {

        .scroll-table { 
            width: 700px !important;
        }
    
        th, td {min-width: 200px; }
    }

    @media (max-width: 700px) {

        .scroll-table { 
            width: 600px !important;
        }
    
        th, td {min-width: 200px; }
    }

    @media (max-width: 500px) {

        .scroll-table { 
            width: 480px !important;
        }
    
        th, td {min-width: 200px; }
    }
    `;

    constructor() {
        super();
        this.StorageService = new StorageService();
        this.currentTableInfo = ""; //test for ruben.
    }

    render() {
        return p$1`
            <div id="course-table-id" class="scroll-table">
                <table class="styled-table" id="t">

                    <caption hidden>Cursussen met een bezem/conversie regeling</caption>

                    <thead>
                        <tr>
                            <th tabindex="0 scope="col">Oude code</th>
                            <th tabindex="0 scope="col">Opleiding</th>
                            <th tabindex="0 scope="col">Oude naam</th>
                            <th tabindex="0 scope="col">Conversie/Bezem</th>
                            <th tabindex="0 scope="col">Nieuwe code</th>
                            <th tabindex="0 scope="col">Nieuwe naam</th>
                            <th tabindex="0 scope="col">Periode</th>
                        </tr>
                    </thead>
                    <tbody></body>
                </table>
            </div>
        `;
    }

  sortTableByColumn(table, column, asc = true) {
        const dirModifier = asc ? 1 : -1;
        const tBody = table.tBodies[0];
        const rows = Array.from(tBody.querySelectorAll("tr"));

        const sortedRows = rows.sort((a, b) => {
            const aColText = a.querySelector(`td:nth-child(${ column + 1 })`).textContent.trim();
            const bColText = b.querySelector(`td:nth-child(${ column + 1 })`).textContent.trim();

            return aColText > bColText ? (1 * dirModifier) : (-1 * dirModifier);
        });

        while (tBody.firstChild) {
            tBody.removeChild(tBody.firstChild);
        }

        tBody.append(...sortedRows);
        table.querySelectorAll("th").forEach(th => th.classList.remove("th-sort-asc", "th-sort-desc"));
        table.querySelector(`th:nth-child(${ column + 1})`).classList.toggle("th-sort-asc", asc);
        table.querySelector(`th:nth-child(${ column + 1})`).classList.toggle("th-sort-desc", !asc);
    }

    addSortFunction() {

        let shadowTable = null;
        if (document.querySelector('student-page') === null) {
            shadowTable = document.querySelector('cursuscoordinator-page').shadowRoot.querySelector('course-info-cursus').shadowRoot;
        } else {
            shadowTable = document.querySelector('student-page').shadowRoot.querySelector('course-info-student').shadowRoot;
        }
        let table = shadowTable.querySelector('course-table').shadowRoot;

        table.querySelectorAll(".styled-table th").forEach(headerCell => {
            headerCell.addEventListener("click", () => {
                const tableElement = headerCell.parentElement.parentElement.parentElement;
                const headerIndex = Array.prototype.indexOf.call(headerCell.parentElement.children, headerCell);
                const currentIsAscending = headerCell.classList.contains("th-sort-asc");
                this.sortTableByColumn(tableElement, headerIndex, !currentIsAscending);
            });
        });
    }

    deleteAscDescFromTableHeaders() {
        let shadowdomTable = this.shadowRoot.querySelector('thead tr');
        shadowdomTable.querySelectorAll("th").forEach(th => th.classList.remove("th-sort-asc", "th-sort-desc"));
      }


    updated() {
        /* Two list for accessing the data from the sheet. */
        var listSheetNames = ['1-Propedeuse BM-U', '2- Prop BKMER', '3-Prop BDK U', '4-Hoofdfase BM-U', '5-Hoofdfase BKMER', '6-Hoofdfase BDK U', '7-Minor ', '8- Conversie over opleidingen ', '9-Geen studenten meer'];
        let KeyListOfConversions = ['9/6/21', 'Versie update', '__EMPTY', '__EMPTY_1', '__EMPTY_2', '__EMPTY_3', '__EMPTY_4', '__EMPTY_5', '__EMPTY_6', '__EMPTY_7', '__EMPTY_8', '__EMPTY_9', '__EMPTY_10', '__EMPTY_11', '__EMPTY_12', '__EMPTY_13', '__EMPTY_14'];


        var listRowObjects2 = this.StorageService.getStorage();

        /* if statement so the page will get the right elements */
        let shadowPage = null;
        if (document.querySelector('student-page') === null) {
            shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
        } else {
            shadowPage = document.querySelector('student-page').shadowRoot;
        }

        let selectElement = shadowPage.querySelector('table-nav').shadowRoot.querySelector('dropdown-tabblad');
        /* fill the combobox in the component */
        if (listRowObjects2 != null){
            listRowObjects2.pop();
            selectElement.fillComboBox(shadowPage, listRowObjects2, listSheetNames, KeyListOfConversions, false);
        }

        this.generateTableSheet("Alle tabladen", listRowObjects2, KeyListOfConversions);
      }


    /* generate the storage for the objects in the local Storage. */
    generateStorage(listrowObject, KeyListOfConversions){
        window.localStorage.setItem('exams', "[]");
        window.localStorage.setItem('courses', "[]");
        window.localStorage.setItem('conversions', "[]");
        let tblBody2 = document.createElement("tbody");
        let tblHead2 = document.createElement("thead");
        KeyListOfConversions = ['9/6/21', 'Versie update', '__EMPTY', '__EMPTY_1', '__EMPTY_2', '__EMPTY_3', '__EMPTY_4', '__EMPTY_5', '__EMPTY_6', '__EMPTY_7', '__EMPTY_8', '__EMPTY_9', '__EMPTY_10', '__EMPTY_11', '__EMPTY_12', '__EMPTY_13', '__EMPTY_14'];
        generateTableSheet1(listrowObject[0], KeyListOfConversions, tblBody2, tblHead2, true);
        generateTableSheet2(listrowObject[1], KeyListOfConversions, tblBody2, tblHead2, true);
        generateTableSheet3(listrowObject[2], KeyListOfConversions, tblBody2, tblHead2, true);
        generateTableSheet4(listrowObject[3], KeyListOfConversions, tblBody2, tblHead2, true);
        generateTableSheet5(listrowObject[4], KeyListOfConversions, tblBody2, tblHead2, true);
        generateTableSheet6and8(listrowObject[5], KeyListOfConversions, tblBody2, tblHead2, true);
        generateTableSheet7(listrowObject[6], KeyListOfConversions, tblBody2, tblHead2, true);
        KeyListOfConversions = ['6/18/21', 'Versie update', '__EMPTY', '__EMPTY_1', '__EMPTY_2', '__EMPTY_3', '__EMPTY_4', '__EMPTY_5', '__EMPTY_6', '__EMPTY_7', '__EMPTY_8', '__EMPTY_9', '__EMPTY_10', '__EMPTY_11', '__EMPTY_12', '__EMPTY_13', '__EMPTY_14'];
        generateTableSheet6and8(listrowObject[7], KeyListOfConversions, tblBody2, tblHead2, true);
        generateTableSheet9(listrowObject[8], KeyListOfConversions, tblBody2, tblHead2, true);
    }

    generateTableSheet(sheet, listrowObject, KeyListOfConversions){
        let shadowPage = null;
        if (document.querySelector('student-page') === null) {
            shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
        } else {
            shadowPage = document.querySelector('student-page').shadowRoot;
        }

       /* if statement so the page will get the right table info element*/
       let shadowTableInfo = null;
       if (shadowPage.querySelector('course-info-student') === null) {
           shadowTableInfo = shadowPage.querySelector('course-info-cursus').shadowRoot;
       } else {
           shadowTableInfo = shadowPage.querySelector('course-info-student').shadowRoot;
       }

        // /* delete the previous contents of the table, so it is empty. */
        let tbl = shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0);
        tbl.tBodies.item(0).innerHTML = "";

        /* get the table element. */
        tbl = shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0);
        tbl.id = sheet;
        /* get the body of the table. this is where the content of the table should be. */
        let tblBody = tbl.tBodies.item(0);
        /* get the header of the table. */
        let tblHead = tbl.tHead;

        if (sheet === '1-Propedeuse BM-U'){
            generateTableSheet1(listrowObject[0], KeyListOfConversions, tblBody, tblHead, false);
            this.currentTableInfo = listrowObject[0];
        }
        else if (sheet === "2- Prop BKMER"){
            generateTableSheet2(listrowObject[1], KeyListOfConversions, tblBody, tblHead, false);
        }
        else if (sheet === "3-Prop BDK U"){
            generateTableSheet3(listrowObject[2], KeyListOfConversions, tblBody, tblHead, false);
        }
        else if (sheet === '4-Hoofdfase BM-U'){
            generateTableSheet4(listrowObject[3], KeyListOfConversions, tblBody, tblHead, false);
        }
        else if (sheet === '5-Hoofdfase BKMER'){
            generateTableSheet5(listrowObject[4], KeyListOfConversions, tblBody, tblHead, false);
        }
        else if (sheet === '6-Hoofdfase BDK U'){
            generateTableSheet6and8(listrowObject[5], KeyListOfConversions, tblBody, tblHead, false);
        }
        else if (sheet === '7-Minor '){
            generateTableSheet7(listrowObject[6], KeyListOfConversions, tblBody, tblHead, false);
        }
        KeyListOfConversions = ['6/18/21', 'Versie update', '__EMPTY', '__EMPTY_1', '__EMPTY_2', '__EMPTY_3', '__EMPTY_4', '__EMPTY_5', '__EMPTY_6', '__EMPTY_7', '__EMPTY_8', '__EMPTY_9', '__EMPTY_10', '__EMPTY_11', '__EMPTY_12', '__EMPTY_13', '__EMPTY_14'];
        if (sheet === '8- Conversie over opleidingen '){
            generateTableSheet6and8(listrowObject[7], KeyListOfConversions, tblBody, tblHead, false);
        }
        else if (sheet === '9-Geen studenten meer'){
            generateTableSheet9(listrowObject[8], KeyListOfConversions, tblBody, tblHead, false);
        }

        else if (sheet === 'Alle tabladen'){
            if (this.StorageService.getStorage() != null){
                KeyListOfConversions = ['9/6/21', 'Versie update', '__EMPTY', '__EMPTY_1', '__EMPTY_2', '__EMPTY_3', '__EMPTY_4', '__EMPTY_5', '__EMPTY_6', '__EMPTY_7', '__EMPTY_8', '__EMPTY_9', '__EMPTY_10', '__EMPTY_11', '__EMPTY_12', '__EMPTY_13', '__EMPTY_14'];
                generateTableSheet2(listrowObject[1], KeyListOfConversions, tblBody, tblHead, false);
                generateTableSheet3(listrowObject[2], KeyListOfConversions, tblBody, tblHead, false);
                generateTableSheet4(listrowObject[3], KeyListOfConversions, tblBody, tblHead, false);
                generateTableSheet5(listrowObject[4], KeyListOfConversions, tblBody, tblHead, false);
                generateTableSheet6and8(listrowObject[5], KeyListOfConversions, tblBody, tblHead, false);
                generateTableSheet7(listrowObject[6], KeyListOfConversions, tblBody, tblHead, false);
                generateTableSheet1(listrowObject[0], KeyListOfConversions, tblBody, tblHead, false);
                KeyListOfConversions = ['6/18/21', 'Versie update', '__EMPTY', '__EMPTY_1', '__EMPTY_2', '__EMPTY_3', '__EMPTY_4', '__EMPTY_5', '__EMPTY_6', '__EMPTY_7', '__EMPTY_8', '__EMPTY_9', '__EMPTY_10', '__EMPTY_11', '__EMPTY_12', '__EMPTY_13', '__EMPTY_14'];
                generateTableSheet6and8(listrowObject[7], KeyListOfConversions, tblBody, tblHead, false);
                generateTableSheet9(listrowObject[8], KeyListOfConversions, tblBody, tblHead, false);
            }
        }
    }

    searchOpenModel(list){
            let shadowTable = null;
            if (document.querySelector('student-page') === null) {
                shadowTable = document.querySelector('cursuscoordinator-page').shadowRoot.querySelector('course-info-cursus').shadowRoot.querySelector('course-modal-cursus').shadowRoot;
            } else {
                shadowTable = document.querySelector('student-page').shadowRoot.querySelector('course-info-student').shadowRoot.querySelector('course-modal-student').shadowRoot;
            }
            let modalDiv = shadowTable.querySelector('#myModal');
            let divModalContent = shadowTable.querySelector('#modal-content');
            let textDiv = shadowTable.querySelector('#text-div');
            modalDiv.classList.add("showModal");
            list.forEach((element) => {
                let inputField = document.createElement('input');
                let label = document.createElement('label');
                let editDiv = document.createElement('div');
                inputField.className="inputField";
                label.htmlFor="inputField";
                editDiv.className="editDiv";
                label.innerHTML = Object.keys(element) + ": ";
                inputField.value = Object.values(element);
                editDiv.appendChild(label);
                editDiv.appendChild(inputField);
                textDiv.appendChild(editDiv);
            });
            divModalContent.appendChild(textDiv);
            modalDiv.style.display = "block";
    }

    showSearchData(list) {
        // let filterValue = document.querySelector('cursuscoordinator-page').shadowRoot.querySelector('table-nav').shadowRoot.querySelector('filter-courses').shadowRoot.querySelector('select').value;

        /* if statement so the page will get the right element*/
        let shadowPage = null;
        let shadowTableInfo = null;
        if (document.querySelector('student-page') == null) {
            shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
            shadowTableInfo = shadowPage.querySelector('course-info-cursus').shadowRoot;
        } else {
            shadowPage = document.querySelector('student-page').shadowRoot;
            shadowTableInfo = shadowPage.querySelector('course-info-student').shadowRoot;
        }
        
        let table = shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0);
        let tbd = table.tBodies.item(0);
        tbd.innerHTML="";
        for (let conversion of list) {
            let tr = document.createElement('tr');
            for (let i = 0; i < 7; i++) {
                let td = document.createElement('td');
                if (i === 4){
                    let cellText = document.createElement("a");  
                    cellText.innerHTML=
                    `<a class="external" href=https://hu.osiris-student.nl/#/inschrijven/cursus/:id target=_blank>${Object.values(conversion[i])}</a>`;
                    td.appendChild(cellText);
                }else {
                    td.innerText = Object.values(conversion[i]);
                }
                tr.appendChild(td);
            }
            let element = shadowTableInfo.querySelector('course-table');
            tr.addEventListener("click", () =>
                element.searchOpenModel(conversion));
            tr.tabIndex= 0;
            tbd.appendChild(tr);
            table.appendChild(tbd);
        }
    }

}

customElements.define('course-table', Coursetable);

class DropdownTab extends s$1 {


    static styles = r$3`
    :host{}

    select {
        font: 400 12px/1.3 sans-serif;
        -webkit-appearance: none;
        appearance: none;
        color: var(--baseFg);
        border: 1px solid var(--baseFg);
        line-height: 1;
        outline: 0;
        padding: 0.65em 2.5em 0.55em 0.75em;
        border-radius: var(--radius);
        background-color: var(--baseBg);
        background-image: linear-gradient(var(--baseFg), var(--baseFg)),
          linear-gradient(-135deg, transparent 50%, var(--accentBg) 50%),
          linear-gradient(-225deg, transparent 50%, var(--accentBg) 50%),
          linear-gradient(var(--accentBg) 42%, var(--accentFg) 42%);
        background-repeat: no-repeat, no-repeat, no-repeat, no-repeat;
        background-size: 1px 100%, 20px 22px, 20px 22px, 20px 100%;
        background-position: right 20px center, right bottom, right bottom, right bottom;
      }
    
    select:hover {
    background-image: linear-gradient(var(--accentFg), var(--accentFg)),
        linear-gradient(-135deg, transparent 50%, var(--accentFg) 50%),
        linear-gradient(-225deg, transparent 50%, var(--accentFg) 50%),
        linear-gradient(var(--accentFg) 42%, var(--accentBg) 42%);
    }
    
    select:active {
    background-image: linear-gradient(var(--accentFg), var(--accentFg)),
        linear-gradient(-135deg, transparent 50%, var(--accentFg) 50%),
        linear-gradient(-225deg, transparent 50%, var(--accentFg) 50%),
        linear-gradient(var(--accentFg) 42%, var(--accentBg) 42%);
    color: var(--accentBg);
    border-color: var(--accentFg);
    background-color: var(--accentFg);
    }
    
    .dropdownTabblad {
        --radius: 5px;
        --baseFg: dimgray;
        --baseBg: white;
        --accentFg: #006fc2;
        --accentBg: #bae1ff;
        width: 400px;
    }
    
    .dropdownTabblad-content a {
        color: black;
        padding: 12px 16px;
        text-decoration: none;
        display: block;
      }
    
    .dropdownTabblad-content a:hover {background-color: #ddd;}
    
    .dropdownTabblad:hover .dropdown-content {display: block;}
    
    .dropdownTabblad:hover .dropbtn {background-color: #3e8e41;}

    .pulse {
      animation-name: color;
      animation-duration: 2s;
      animation-iteration-count: infinite;
  }

  @keyframes color {
      0% {
        background-color: #fafafa;
      }
      50% {
        background-color: #ff8c8c;
      }
      100 {
        background-color: #fafafa;
      }
    }

    ` 

    render(){
        return p$1`
        <select id="dropdown" name="dropdown" class="dropdownTabblad" @click="${this.twoFunctions}">
          <option>Alle tabladen</option>
        </select>`;
    }


    twoFunctions() {
        this.deletePulse();
        let tableElement = null;
        if (document.querySelector('student-page') === null) {
          tableElement = document.querySelector('cursuscoordinator-page').shadowRoot.querySelector('course-info-cursus').shadowRoot.querySelector('course-table');
        } else {
          tableElement = document.querySelector('student-page').shadowRoot.querySelector('course-info-student').shadowRoot.querySelector('course-table');
        }
        tableElement.deleteAscDescFromTableHeaders();
    }

    fillComboBox(shadowPage, listRowObjects2, listSheetNames, KeyListOfConversions, generateLocalStorageBool){
      if (this.shadowRoot.getElementById('dropdown').length === 1){
        listRowObjects2.forEach((name, index) =>{
          let element = document.createElement("option");
          element.textContent = name[0]['Versie update'];
          element.value = listSheetNames[index];
          this.shadowRoot.getElementById('dropdown').appendChild(element);
        });        
        
        /* if statement so the page will get the right table info element*/
        let shadowTableInfo = null;
        if (shadowPage.querySelector('course-info-student') === null) {
          shadowTableInfo = shadowPage.querySelector('course-info-cursus').shadowRoot;
        } else {
          shadowTableInfo = shadowPage.querySelector('course-info-student').shadowRoot;
        }
        
        let tableElement = shadowTableInfo.querySelector('course-table');
        tableElement.addSortFunction();

        this.shadowRoot.getElementById('dropdown').addEventListener('change', () => {
            tableElement.generateTableSheet(this.shadowRoot.getElementById('dropdown').value, listRowObjects2, KeyListOfConversions);
        });
        if (generateLocalStorageBool){
          tableElement.generateStorage(listRowObjects2, KeyListOfConversions);
        }
      }
    }
      
    deletePulse() {
      let shadowPage = null;
      if (document.querySelector('student-page') === null) {
          shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
      } else {
          shadowPage = document.querySelector('student-page').shadowRoot;
      }
      let shadowdom = shadowPage.querySelector('table-nav').shadowRoot.querySelector('dropdown-tabblad').shadowRoot.querySelector('select');
      shadowdom.classList.remove("pulse");
    }
}

customElements.define('dropdown-tabblad', DropdownTab);

class exportButton extends s$1 {

    static styles = r$3`
    .export-button {
        padding: 0.8rem 1.5rem;
        font-weight: bold;
        font-size: 0.9rem;
        color: 0, 0, 0;
        border: none;
        border-radius: 15px;
        outline: none;
        cursor: pointer;
        background: rgb(171 171 171);
        margin-left: 1rem;

    }
    

    .button-label:hover, .export-button:hover {
        background: rgb(145 145 145);
    }
    
    .button-label:active, .export-button:active {
        transform: scale(.98);
    }
    
    `;

    constructor() {
        super();
        this.ConversionService = new ConversionService();
        this.courseService = new CourseService();
    }
    
    
    render() {
        return p$1`
        <div tabindex="0" .onkeyup=${(e) => this.keyUpHandler(e)}>
            <button class="export-button" @click="${this._exportSheetToExcel}">
                Exporteren
            </button>
        </div>
        `;
    }

    
    keyUpHandler(e) {
        if (e.key === 'Enter') {
            this.shadowRoot.querySelector('.export-button').click();
        }
    }

    

    _exportSheetToExcel() {  
        const wb = XLSX.utils.book_new();

        this._fillTableWithData(wb, 'sheet1');
        this._fillTableWithData(wb, 'sheet2');
        this._fillTableWithData(wb, 'sheet3');
        this._fillTableWithData(wb, 'sheet4');
        this._fillTableWithData(wb, 'sheet5');
        this._fillTableWithData(wb, 'sheet6');
        this._fillTableWithData(wb, 'sheet7');
        this._fillTableWithData(wb, 'sheet8');
        this._fillTableWithData(wb, 'sheet9');

        this._exportFunction(wb);
    }

    _fillTableWithData(wb, sheet) {
        let conversionList =  this.ConversionService.getConversions();
        let conversions = [];
        for(let item of conversionList) {
            if(item.sheet === sheet) { //sheet variable
                conversions.push({
                    "Opleiding" : item.oldCourse.education,
                    "Oude code" : item.oldCourse.code,  
                    "Oude name" : item.oldCourse.name,
                    "Oude periode" : item.oldCourse.period,
                    "Oude EC-cursus" : item.oldCourse.ecCourse,
                    "Oude Toets en toetsvorm" : item.oldCourse.exams.examType,
                    "Oude Weging %" :  item.oldCourse.exams.weighting,
                    "Oude EC-toets" : item.oldCourse.exams.ecExam,
                    "Code" : item.newCourse.code,  
                    "Naam" : item.newCourse.name,
                    "Periode" : item.newCourse.period,
                    "EC-cursus" : item.newCourse.ecCourse,
                    "Toets en toetsvorm" : item.newCourse.exams.examType,
                    "Weging %" :  item.newCourse.exams.weighting,
                    "EC-cursus" : item.newCourse.exams.ecExam,
                    "coordinator" : item.newCourse.exams.coordinator
                });
            }
        }
        const ws = XLSX.utils.json_to_sheet(conversions);
        XLSX.utils.book_append_sheet(wb, ws, sheet);
    }
        
    _exportFunction(wb) {
        const fileName = 'BezemEnConversieRegeling.xlsx';
        XLSX.writeFile(wb, fileName);
    }
}

customElements.define('export-button', exportButton);

class exportImportWorker extends s$1 {
 
    static styles = r$3`
    #course-table-export-import-id {
        margin-top: 1.5rem;
        margin-right: 2rem;
        margin-bottom: 1.5rem;
        padding-left: 3rem;
        padding-right: 3rem;
        display: flex;
        align-items: center;
        justify-content: right;
    }    

    .left{
        margin-right:auto;
    }

    `;

    constructor() {
        super();
    }

    render() {
        return p$1`
            <div id="course-table-export-import-id">
                <div id="info" class="left">
                    <crud-koppeling></crud-koppeling>   
                </div>
                <import-excel></import-excel>
                <export-button></export-button>
            </div>
        `;
    }
}

customElements.define('export-import-worker', exportImportWorker);

class FilterCourses extends s$1 {
    static styles = r$3`

    select {
        font: 400 12px/1.3 sans-serif;
        -webkit-appearance: none;
        appearance: none;
        color: var(--baseFg);
        border: 1px solid var(--baseFg);
        line-height: 1;
        outline: 0;
        padding: 0.65em 2.5em 0.55em 0.75em;
        border-radius: var(--radius);
        background-color: var(--baseBg);
        background-image: linear-gradient(var(--baseFg), var(--baseFg)),
          linear-gradient(-135deg, transparent 50%, var(--accentBg) 50%),
          linear-gradient(-225deg, transparent 50%, var(--accentBg) 50%),
          linear-gradient(var(--accentBg) 42%, var(--accentFg) 42%);
        background-repeat: no-repeat, no-repeat, no-repeat, no-repeat;
        background-size: 1px 100%, 20px 22px, 20px 22px, 20px 100%;
        background-position: right 20px center, right bottom, right bottom, right bottom;
      }
    
    select:hover {
    background-image: linear-gradient(var(--accentFg), var(--accentFg)),
        linear-gradient(-135deg, transparent 50%, var(--accentFg) 50%),
        linear-gradient(-225deg, transparent 50%, var(--accentFg) 50%),
        linear-gradient(var(--accentFg) 42%, var(--accentBg) 42%);
    }
    
    select:active {
    background-image: linear-gradient(var(--accentFg), var(--accentFg)),
        linear-gradient(-135deg, transparent 50%, var(--accentFg) 50%),
        linear-gradient(-225deg, transparent 50%, var(--accentFg) 50%),
        linear-gradient(var(--accentFg) 42%, var(--accentBg) 42%);
    color: var(--accentBg);
    border-color: var(--accentFg);
    background-color: var(--accentFg);
    }
    
    .dropdownTabblad {
        --radius: 5px;
        --baseFg: dimgray;
        --baseBg: white;
        --accentFg: #006fc2;
        --accentBg: #bae1ff;
        
    }
    
    .dropdownTabblad-content a {
        color: black;
        padding: 12px 16px;
        text-decoration: none;
        display: block;
      }
    
    .dropdownTabblad-content a:hover {background-color: #ddd;}
    
    .dropdownTabblad:hover .dropdown-content {display: block;}
    
    .dropdownTabblad:hover .dropbtn {background-color: #3e8e41;}

    `;

    constructor() {
        super();
        this.courseTable = new Coursetable;
    }

    render() {
        return p$1`
            <div class="dropdownTabblad-content" id="filter" >
                <select id="dropdown" class="dropdownTabblad" @change="${this.changeHandler}">
                    <option>kies een periode</option>
                    <option value="A">A</option>
                    <option value="B"> B</option>
                    <option value="C" >C</option>
                    <option value="D">D</option>
                    <option value="E">E</option>
                    <option value="Jaar">Jaar</option>
                </select>
            </div>
    `;
    }

    changeHandler(e) {
        this.filterCourses(e.target.value);
    }

    filterCourses() {
        let shadowPage=null;
        if (document.querySelector('student-page') === null) {
            shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
        } else {
            shadowPage = document.querySelector('student-page').shadowRoot;
        }
        let value = shadowPage.querySelector('table-nav').shadowRoot.querySelector('filter-courses').shadowRoot.querySelector('select').value;
        let elementFindCourse = shadowPage.querySelector('table-nav').shadowRoot.querySelector('find-course');
        let conversions = elementFindCourse.list;
        let filterConversions = [];
        if(value!=="kies een periode"){
        for (let conversion of conversions){
            if (Object.values(conversion[6])[0].includes(value)){
                filterConversions.push(conversion);
            }
        }
        this.courseTable.showSearchData(filterConversions);
        }
    }
}

customElements.define('filter-courses', FilterCourses);

class FindCourse extends s$1 {
    static styles = r$3`
#search {
    grid-area: search;
    height: fit-content;
    width:100%;
    display: flex;
    align-items: flex-start;
    justify-content:right;
}
#search-id {
    width: 300px;
    border-color: gainsboro;
}
.flex-container-search{
    display: flex;
    flex-direction:row;
    border:1px solid grey;
    padding:2px;
    border-radius: 5px;
    width: fit-content;
}
.inputfield{
    flex-grow:2;
    border:none;
}

.inputfield:focus {
    outline: none;
  }
.search-button {
    border: none;
    background: white;
    opacity: 0.8;
}
.search-button:active {
    transform: scale(.92);
}
.search-button:active,
.search-button:hover,
.search-button:focus {
    cursor: pointer;
    opacity: 1;
    outline: 1;
}

    `;

    constructor() {
        super();
        this.conversionService = new ConversionService();
        this.list = "";
        this.courseTable = new Coursetable();
        this.filterTable = new FilterCourses();

    }

    render() {
        return p$1`
            <div class="flex-container-search">
                <input  tabindex="0"
                        name="search"
                        class="inputfield"
                        type="search"
                        id="search-id"
                        placeholder="Zoek naar een code..."
                        aria-label="Zoeken naar code"
                        value="${this.value}"
                        .onkeyup="${(e) => this.keyUpHandler(e)}">
                <button class="search-button" type="submit" @click="${this.clickHandler}" >
                    <img src="src/images/search.png" alt="zoek icon" width="16px" height="17px">
                </button>
            </div>`;

    }

    keyUpHandler(e) {
            this.findCourse(e.target.value);
    }

    clickHandler() {
        this.findCourse(this.shadowRoot.querySelector('input').value);
    }

    findCourse(value) {
        /* if statement so the page will get the right element*/
        let shadowPage = null;
        let shadowTableInfo = null;
        if (document.querySelector('student-page') == null) {
            shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
            shadowTableInfo = shadowPage.querySelector('course-info-cursus').shadowRoot;
        } else {
            shadowPage = document.querySelector('student-page').shadowRoot;
            shadowTableInfo = shadowPage.querySelector('course-info-student').shadowRoot;
        }

        //de header goed
        shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(0).innerHTML = "Oude code";
        shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(1).innerHTML = "Opleiding";
        shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(2).innerHTML = "Oude naam";

        /// hier gebruik ik de localstorage omdat de data is niet in de model zijn opgeslagen
        let conversions = this.conversionService.getConversions();
        let arrayList = [];
        console.log(value);

        for (let item of conversions) {
            let conversion =[];
            if (item.oldCourse.code.includes(value) || item.newCourse.code.includes(value)) {
                conversion.push({"oldCode": item.oldCourse.code},
                    {"education":item.oldCourse.education},
                    {"oldName":item.oldCourse.name},
                    {"bezem/Conversion":item.bezemOrConversion},
                    {"newCode":item.newCourse.code},
                    {"newName":item.newCourse.name},
                    {"period":item.newCourse.period},
                    {"EC-Cursus":item.newCourse.ecCourse},
                    {"Toets en toetsvorm":item.newCourse.exams.examType},
                    {"Weging nieuwecourse":item.newCourse.exams.weighting},
                    {"Weging oudecourse":item.oldCourse.exams.weighting},
                    {"EC-nieuwetoets":item.newCourse.exams.ecExam},
                    {"EC-oudetoets":item.oldCourse.exams.ecExam},
                    {"Programmaleider nieuw":item.newCourse.exams.coordinator}
                );
                arrayList.push(conversion);
            }
        }
        this.list = arrayList;
        this.courseTable.showSearchData(arrayList);
    }

}

customElements.define('find-course', FindCourse);

class importExcel extends s$1 {

    static styles = r$3`
        .button-label {
            padding: 0.8rem 1.5rem;
            font-weight: bold;
            font-size: 0.9rem;
            color: 0, 0, 0;
            border: none;
            border-radius: 15px;
            outline: none;
            cursor: pointer;
            background: rgb(171 171 171);
        }

        .button-label:hover, .export-button:hover {
            background: rgb(145 145 145);
        }
        
        .button-label:active, .export-button:active {
            transform: scale(.98);
        }

        #modal-load {
            display: none; 
            position: absolute; 
            z-index: 3; 
            overflow: auto; 
            left: 50%;
            bottom: 65px;
            transform: translate(-50%, -50%);
            margin: 0 auto;

        
            background: #E0EAFC;  
            background: -webkit-linear-gradient(to right, #CFDEF3, #E0EAFC);  
            background: linear-gradient(to right, #CFDEF3, #E0EAFC); 

            width: 250px;
            height:60px;
            animation: appear 201ms ease-in 1;
            margin: auto;
            padding: 5px;
            border-radius: .25em .25em .4em .4em;
            box-shadow: rgb(38, 57, 77) 0px 20px 30px -10px;
            text-align: center;
            font-size:1.5em;
        }

        @keyframes appear {
            0%{
                opacity: 0;
                transform: translateY(-10px);
            }
        }

        .button__text {
            color:#2e2e2e;
            font-size: 1.1rem;
            transition: all 0.2s;
        }

        .button__text__fout {
            color:#2e2e2e;
            font-size: 1.1rem;
            transition: all 0.2s;
        }

        
        .button--loading .button__text {
            visibility: hidden;
        }

        .button--loading::after {
            content: "";
            position: absolute;
            width: 32px;
            height: 32px;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            margin: auto;
            border: 4px solid transparent;
            border-top-color: black;
            border-radius: 50%;
            animation: button-loading-spinner 1s ease infinite;
        }
      
        @keyframes button-loading-spinner {
            from {
            transform: rotate(0turn);
            }
        }
        
        @keyframes button-loading-spinner {
            from {
                transform: rotate(0turn);
            }
        
            to {
                transform: rotate(1turn);
            }
        }  
    `;

    constructor() {
        super();
        this.StorageService = new StorageService();
    }


    render() {
        return p$1`
            <div tabindex="0" .onkeyup=${(e) => this.keyUpHandler(e)}>
                <input class="import-button" id="input" type="file" accept=".xls,.xlsx" @change="${this.triggerImportButton}"  hidden>      
                <label for="input" class="button-label">Bestand Kiezen</label>  
            </div>

            <div class="modal-load" id="modal-load" role="alertdialog">
                <p class="button__text"></p>
                <p class="button__text__fout"></p>
            </div>

            `;
    }


    showLoadingModal() {
        let modalDivLoad = this.shadowRoot.querySelector('#modal-load');
        modalDivLoad.style.display = 'block';
        modalDivLoad.classList.toggle('button--loading');
    }

    hideLoadingModal() {
        let modalDivLoad = this.shadowRoot.querySelector('#modal-load');
        modalDivLoad.style.display = 'none';
    }

    
    popupConfirmation() {
        let modalDivLoad = this.shadowRoot.querySelector('#modal-load');
        let shadowdom = document.querySelector('cursuscoordinator-page').shadowRoot.querySelector('table-nav').shadowRoot.querySelector('dropdown-tabblad').shadowRoot.querySelector('select');
        let importText = modalDivLoad.querySelector('.button__text');
        modalDivLoad.classList.remove('button--loading');
        importText.innerHTML = "Bestand is  geïmporteerd";
        shadowdom.className += " pulse";


        setTimeout(function(){
            modalDivLoad.style.display = 'none';
            shadowdom.classList.remove("pulse");
            importText.innerHTML = "";
        },5700);
    }

    alertPopup() {
        let modalDivLoad = this.shadowRoot.querySelector('#modal-load');
        modalDivLoad.classList.remove('button--loading');
        let textModalLast = modalDivLoad.querySelector('.button__text__fout');
        textModalLast.innerHTML = "Geen geldig bestand!";
        setTimeout(function(){
            modalDivLoad.style.display = 'none';
            textModalLast.innerHTML = "";
        },4700);
    }


    keyUpHandler(e) {       
        if (e.key === 'Enter') {
            this.shadowRoot.querySelector('#input').click();
        }
    }

    triggerImportButton(event){
        let selectedFile = event.target.files[0];
        
        if (selectedFile) {
            // Call the load modal
            this.showLoadingModal();

            let fileReader = new FileReader();
   
            fileReader.readAsBinaryString(selectedFile);
            fileReader.onload = (event)=> {

    
                let binaryData = event.target.result;
            
                let workbook = XLSX.read(binaryData, {type: "binary"});
                    
                let listSheetNames = workbook.SheetNames;
                listSheetNames.shift();
                let listRowObjects = [];
  
                workbook.SheetNames.forEach(sheet => {
                    if (sheet != "overzichtspagina"){
                        listRowObjects.push(XLSX.utils.sheet_to_json(workbook.Sheets[sheet]));
                    }
                });

                if(listRowObjects.length !== 0 && Object.values(listRowObjects[0][0])[0] === "Bezem & Conversie Propedeuse BM Utrecht studiejaar 2021-2022") {
                    
                    this.StorageService.saveDatabase(listRowObjects);
                    
                    let KeyListOfConversions = ['9/6/21', 'Versie update', '__EMPTY', '__EMPTY_1', '__EMPTY_2', '__EMPTY_3', '__EMPTY_4', '__EMPTY_5', '__EMPTY_6', '__EMPTY_7', '__EMPTY_8', '__EMPTY_9', '__EMPTY_10', '__EMPTY_11', '__EMPTY_12', '__EMPTY_13', '__EMPTY_14'];
                    
                    let shadowPage = null;
                    let shadowTableInfo = null;
                    if (document.querySelector('student-page') === null) {
                        shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
                        shadowTableInfo = shadowPage.querySelector('course-info-cursus').shadowRoot;
                    } else {
                        shadowPage = document.querySelector('student-page').shadowRoot;
                        shadowTableInfo = shadowPage.querySelector('course-info-student').shadowRoot;
                    }

    
                    let selectElement = shadowPage.querySelector('table-nav').shadowRoot.querySelector('dropdown-tabblad');  
                    /* fill the combobox in the component */
                    selectElement.fillComboBox(shadowPage, listRowObjects, listSheetNames, KeyListOfConversions, true);


                    /* show confirmation modal */ 
                    this.popupConfirmation();
                    let tableElement = shadowTableInfo.querySelector('course-table');
                    tableElement.generateTableSheet("Alle tabladen", listRowObjects, KeyListOfConversions);
                    this.StorageService.addExtraSheet();
                } else {
                    this.alertPopup();
                }
            };
        }
    }
}

customElements.define('import-excel', importExcel);

class infoModal extends s$1 {
    static styles = r$3`
        .info-button {
            border: none;
            border-radius: 145px;
            cursor: pointer;
            outline: none;
            background-color: whitesmoke;
            max-width: fit-content;
        }
        #modal {
            display: none; 
            position: fixed; 
            z-index: 3; 

            padding-top: 100px; 
            left: 0;
            top: 0;
            width: 100%; 
            height: 100%; 
            overflow: auto; 
            background-color: rgb(0,0,0); 
            background-color: rgba(0,0,0,0.4); 
        }
        
        .modal-content {
            background-color: #fefefe;
            margin: auto;
            padding: 20px;
            border: 1px solid #888;
            width: 55%;
            border-radius: 10px;
            animation: appear 201ms ease-in 1;
        }
        .close:hover,
        .close:focus {
            color: #000;
            text-decoration: none;
            cursor: pointer;
        }
        .close {
            width: 30px;
            font-size: 20px;
            color: #c0c5cb;
            align-self: flex-end;
            background-color: transparent;
            border: none;
            margin-bottom: 10px;
            float: right;
        }

        @keyframes appear {
            0%{
                opacity: 0;
                transform: translateY(-10px);
            }
        }
    `;

    constructor() {
        super();           
    }

    render() {
        return p$1`
        <section id = "modal-section" @click="${this._closeModalOutside}">
            <input type="image" class="info-button" id="info-button" @click="${this._twoFunctions}" src="./src/images/question-mark.png" alt="info knop" width="45px" height="25px">     
            <div id="modal" role="alertdialog">
                <div class="modal-content" role="alertdialog">
                    
                    <div class="modal-body" role="alertdialog">

                        <button class="close" aria-labelledby="escape knop" id="close-button" @click="${this._hideModal}">✖</button>

                        <h1 tabindex="0" >Stappenplan voor het importeren van een excel bestand</h1>
                        <p tabindex="0">
                        <span >&#8226;</span> Klik op de Choose File knop <br>
                        <span>&#8226;</span> Selecteer het excel bestand dat je wilt importeren <br>
                        <span>&#8226;</span> Klik op de "kiess een tablad" knop <br>
                        <span>&#8226;</span> Selecteer het tablad wat je in wilt laden op de pagina <br>
                        </p>
                        <h2 tabindex="0" >Navigatie door de tabel</h2>
                        <p tabindex="0">
                        In de tabel zie je een overzicht van alle cursussen die een vervangend vak hebben. <br>
                        per cursus krijg je de volgende eigenschappen te zien: Opleiding, Oude naam, Nieuwe naam, Oude Code, Nieuwe code, Periode, Bezem/conversie.
                        in de laatste kolom is te zien of het vak volgens de bezem of conversie regeling gaat. <br>
                        Door in de zoekbalk een oude code van een cursus in te voeren krijg je de informatie van vakken met een overeenkomende oude code. 
                        Door op een cursus in de tabel te klikken krijg je een gedetaileerd overzicht van de geselecteerde cursus. 
                        <p>
                        <h3 tabindex="0" >Informatie over bezem/conversie regeling</h3>
                        <p tabindex="0">
                        Bezem: Er wordt geen les meer gegeven voor de cursus maar er is nog een laatste kans om het examen te maken.
                        <br>
                        Conversie: De cursus wordt niet langer meer gegeven en wordt vervangen door een ander vak.
                        </p>
                    </div>
                </div>
            </div>
            </section>
            
        `;
    }

    _twoFunctions() {
        this._focusAccessable();
        this._showModal();
    }

    _focusAccessable() {
        const focusableElements = 'button, h1, span, h2, h3, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const modal = this.shadowRoot.querySelector('#modal');

        const firstFocusableElement = this.shadowRoot.querySelector('button');
        const focusableContent = modal.querySelectorAll(focusableElements);
        const lastFocusableElement = focusableContent[focusableContent.length - 1]; 

        let shadow = this.shadowRoot;

        document.addEventListener('keydown', function(e) {
            let isTabPressed = e.key === 'Tab' || e.keyCode === 9;

            if (!isTabPressed) {
                return;
            }

            if (e.shiftKey ) { 
                if (shadow.activeElement === firstFocusableElement) {
                    lastFocusableElement.focus();
                    e.preventDefault();
                }
            } else { 
                if (shadow.activeElement === lastFocusableElement) { 
                    firstFocusableElement.focus();
                    e.preventDefault();
                }
            }
        });
    }

    _showModal() {
        let modalDiv = this.shadowRoot.querySelector('#modal');
        modalDiv.style.display = 'block';
    }

    _hideModal() {
        let modalDiv = this.shadowRoot.querySelector('#modal');
        modalDiv.style.display = 'none';
    }

    _closeModalOutside(event) {
        let modalDiv = this.shadowRoot.querySelector('#modal');
        if (event.target == modalDiv) {
            modalDiv.style.display = "none";
        }
    }
}

customElements.define('info-modal', infoModal);

class tablenav extends s$1 {

    static styles = r$3`
        .table-nav {
            padding-left: 3rem;
            padding-right: 3rem;
            margin-top: 4rem;
            margin-bottom: 0.5rem;

            display: flex;
            flex-flow: row wrap;
            justify-content:flex-end;
            gap: 10px;
        }
        
        
        #info {
            height: fit-content;
            width: fit-content;
        }

        .search {
            flex-grow: 1;
            margin-right: auto;
        }
        
        
        #filter {
            padding-right: 3px;
        }
        
        
        #search {
            width:fit-content;
        }
        
        #search-id {
            border-color: gainsboro;
        }

        .left{
            margin-right:auto;
        }

        @media all and (max-width: 900px) {
            .table-nav {
                flex-direction: column;
            }
        }

        @media all and (max-width: 800px) {
            .table-nav {
                flex-direction: column;
            }
        }

    `;

    constructor() {
        super();
    }

    render() {
        return p$1`
        <div class="table-nav">
        
            <div id="info" class="left">
                <info-modal></info-modal>
            </div>

            <div id="search"  class="search left">
                <find-course></find-course>
            </div>            

            <filter-courses class="filterClass right"></filter-courses>
            
            <dropdown-tabblad class="dropdownClass" right></dropdown-tabblad>


        </div>
        `;
    }
}

customElements.define('table-nav', tablenav);

function n(n){for(var r=arguments.length,t=Array(r>1?r-1:0),e=1;e<r;e++)t[e-1]=arguments[e];if("production"!==process.env.NODE_ENV){var i=Y[n],o=i?"function"==typeof i?i.apply(null,t):i:"unknown error nr: "+n;throw Error("[Immer] "+o)}throw Error("[Immer] minified error nr: "+n+(t.length?" "+t.map((function(n){return "'"+n+"'"})).join(","):"")+". Find the full error at: https://bit.ly/3cXEKWf")}function r(n){return !!n&&!!n[Q]}function t(n){return !!n&&(function(n){if(!n||"object"!=typeof n)return !1;var r=Object.getPrototypeOf(n);if(null===r)return !0;var t=Object.hasOwnProperty.call(r,"constructor")&&r.constructor;return t===Object||"function"==typeof t&&Function.toString.call(t)===Z}(n)||Array.isArray(n)||!!n[L]||!!n.constructor[L]||s(n)||v(n))}function i(n,r,t){void 0===t&&(t=!1),0===o(n)?(t?Object.keys:nn)(n).forEach((function(e){t&&"symbol"==typeof e||r(e,n[e],n);})):n.forEach((function(t,e){return r(e,t,n)}));}function o(n){var r=n[Q];return r?r.i>3?r.i-4:r.i:Array.isArray(n)?1:s(n)?2:v(n)?3:0}function u(n,r){return 2===o(n)?n.has(r):Object.prototype.hasOwnProperty.call(n,r)}function a(n,r){return 2===o(n)?n.get(r):n[r]}function f(n,r,t){var e=o(n);2===e?n.set(r,t):3===e?(n.delete(r),n.add(t)):n[r]=t;}function c(n,r){return n===r?0!==n||1/n==1/r:n!=n&&r!=r}function s(n){return X&&n instanceof Map}function v(n){return q&&n instanceof Set}function p(n){return n.o||n.t}function l(n){if(Array.isArray(n))return Array.prototype.slice.call(n);var r=rn(n);delete r[Q];for(var t=nn(r),e=0;e<t.length;e++){var i=t[e],o=r[i];!1===o.writable&&(o.writable=!0,o.configurable=!0),(o.get||o.set)&&(r[i]={configurable:!0,writable:!0,enumerable:o.enumerable,value:n[i]});}return Object.create(Object.getPrototypeOf(n),r)}function d(n,e){return void 0===e&&(e=!1),y(n)||r(n)||!t(n)?n:(o(n)>1&&(n.set=n.add=n.clear=n.delete=h),Object.freeze(n),e&&i(n,(function(n,r){return d(r,!0)}),!0),n)}function h(){n(2);}function y(n){return null==n||"object"!=typeof n||Object.isFrozen(n)}function b(r){var t=tn[r];return t||n(18,r),t}function m(n,r){tn[n]||(tn[n]=r);}function _(){return "production"===process.env.NODE_ENV||U||n(0),U}function j(n,r){r&&(b("Patches"),n.u=[],n.s=[],n.v=r);}function O(n){g(n),n.p.forEach(S),n.p=null;}function g(n){n===U&&(U=n.l);}function w(n){return U={p:[],l:U,h:n,m:!0,_:0}}function S(n){var r=n[Q];0===r.i||1===r.i?r.j():r.O=!0;}function P(r,e){e._=e.p.length;var i=e.p[0],o=void 0!==r&&r!==i;return e.h.g||b("ES5").S(e,r,o),o?(i[Q].P&&(O(e),n(4)),t(r)&&(r=M(e,r),e.l||x(e,r)),e.u&&b("Patches").M(i[Q].t,r,e.u,e.s)):r=M(e,i,[]),O(e),e.u&&e.v(e.u,e.s),r!==H?r:void 0}function M(n,r,t){if(y(r))return r;var e=r[Q];if(!e)return i(r,(function(i,o){return A(n,e,r,i,o,t)}),!0),r;if(e.A!==n)return r;if(!e.P)return x(n,e.t,!0),e.t;if(!e.I){e.I=!0,e.A._--;var o=4===e.i||5===e.i?e.o=l(e.k):e.o;i(3===e.i?new Set(o):o,(function(r,i){return A(n,e,o,r,i,t)})),x(n,o,!1),t&&n.u&&b("Patches").R(e,t,n.u,n.s);}return e.o}function A(e,i,o,a,c,s){if("production"!==process.env.NODE_ENV&&c===o&&n(5),r(c)){var v=M(e,c,s&&i&&3!==i.i&&!u(i.D,a)?s.concat(a):void 0);if(f(o,a,v),!r(v))return;e.m=!1;}if(t(c)&&!y(c)){if(!e.h.F&&e._<1)return;M(e,c),i&&i.A.l||x(e,c);}}function x(n,r,t){void 0===t&&(t=!1),n.h.F&&n.m&&d(r,t);}function z(n,r){var t=n[Q];return (t?p(t):n)[r]}function I(n,r){if(r in n)for(var t=Object.getPrototypeOf(n);t;){var e=Object.getOwnPropertyDescriptor(t,r);if(e)return e;t=Object.getPrototypeOf(t);}}function k(n){n.P||(n.P=!0,n.l&&k(n.l));}function E(n){n.o||(n.o=l(n.t));}function R(n,r,t){var e=s(r)?b("MapSet").N(r,t):v(r)?b("MapSet").T(r,t):n.g?function(n,r){var t=Array.isArray(n),e={i:t?1:0,A:r?r.A:_(),P:!1,I:!1,D:{},l:r,t:n,k:null,o:null,j:null,C:!1},i=e,o=en;t&&(i=[e],o=on);var u=Proxy.revocable(i,o),a=u.revoke,f=u.proxy;return e.k=f,e.j=a,f}(r,t):b("ES5").J(r,t);return (t?t.A:_()).p.push(e),e}function D(e){return r(e)||n(22,e),function n(r){if(!t(r))return r;var e,u=r[Q],c=o(r);if(u){if(!u.P&&(u.i<4||!b("ES5").K(u)))return u.t;u.I=!0,e=F(r,c),u.I=!1;}else e=F(r,c);return i(e,(function(r,t){u&&a(u.t,r)===t||f(e,r,n(t));})),3===c?new Set(e):e}(e)}function F(n,r){switch(r){case 2:return new Map(n);case 3:return Array.from(n)}return l(n)}function N(){function t(n,r){var t=s[n];return t?t.enumerable=r:s[n]=t={configurable:!0,enumerable:r,get:function(){var r=this[Q];return "production"!==process.env.NODE_ENV&&f(r),en.get(r,n)},set:function(r){var t=this[Q];"production"!==process.env.NODE_ENV&&f(t),en.set(t,n,r);}},t}function e(n){for(var r=n.length-1;r>=0;r--){var t=n[r][Q];if(!t.P)switch(t.i){case 5:a(t)&&k(t);break;case 4:o(t)&&k(t);}}}function o(n){for(var r=n.t,t=n.k,e=nn(t),i=e.length-1;i>=0;i--){var o=e[i];if(o!==Q){var a=r[o];if(void 0===a&&!u(r,o))return !0;var f=t[o],s=f&&f[Q];if(s?s.t!==a:!c(f,a))return !0}}var v=!!r[Q];return e.length!==nn(r).length+(v?0:1)}function a(n){var r=n.k;if(r.length!==n.t.length)return !0;var t=Object.getOwnPropertyDescriptor(r,r.length-1);if(t&&!t.get)return !0;for(var e=0;e<r.length;e++)if(!r.hasOwnProperty(e))return !0;return !1}function f(r){r.O&&n(3,JSON.stringify(p(r)));}var s={};m("ES5",{J:function(n,r){var e=Array.isArray(n),i=function(n,r){if(n){for(var e=Array(r.length),i=0;i<r.length;i++)Object.defineProperty(e,""+i,t(i,!0));return e}var o=rn(r);delete o[Q];for(var u=nn(o),a=0;a<u.length;a++){var f=u[a];o[f]=t(f,n||!!o[f].enumerable);}return Object.create(Object.getPrototypeOf(r),o)}(e,n),o={i:e?5:4,A:r?r.A:_(),P:!1,I:!1,D:{},l:r,t:n,k:i,o:null,O:!1,C:!1};return Object.defineProperty(i,Q,{value:o,writable:!0}),i},S:function(n,t,o){o?r(t)&&t[Q].A===n&&e(n.p):(n.u&&function n(r){if(r&&"object"==typeof r){var t=r[Q];if(t){var e=t.t,o=t.k,f=t.D,c=t.i;if(4===c)i(o,(function(r){r!==Q&&(void 0!==e[r]||u(e,r)?f[r]||n(o[r]):(f[r]=!0,k(t)));})),i(e,(function(n){void 0!==o[n]||u(o,n)||(f[n]=!1,k(t));}));else if(5===c){if(a(t)&&(k(t),f.length=!0),o.length<e.length)for(var s=o.length;s<e.length;s++)f[s]=!1;else for(var v=e.length;v<o.length;v++)f[v]=!0;for(var p=Math.min(o.length,e.length),l=0;l<p;l++)o.hasOwnProperty(l)||(f[l]=!0),void 0===f[l]&&n(o[l]);}}}}(n.p[0]),e(n.p));},K:function(n){return 4===n.i?o(n):a(n)}});}var G,U,W="undefined"!=typeof Symbol&&"symbol"==typeof Symbol("x"),X="undefined"!=typeof Map,q="undefined"!=typeof Set,B="undefined"!=typeof Proxy&&void 0!==Proxy.revocable&&"undefined"!=typeof Reflect,H=W?Symbol.for("immer-nothing"):((G={})["immer-nothing"]=!0,G),L=W?Symbol.for("immer-draftable"):"__$immer_draftable",Q=W?Symbol.for("immer-state"):"__$immer_state",Y={0:"Illegal state",1:"Immer drafts cannot have computed properties",2:"This object has been frozen and should not be mutated",3:function(n){return "Cannot use a proxy that has been revoked. Did you pass an object from inside an immer function to an async process? "+n},4:"An immer producer returned a new value *and* modified its draft. Either return a new value *or* modify the draft.",5:"Immer forbids circular references",6:"The first or second argument to `produce` must be a function",7:"The third argument to `produce` must be a function or undefined",8:"First argument to `createDraft` must be a plain object, an array, or an immerable object",9:"First argument to `finishDraft` must be a draft returned by `createDraft`",10:"The given draft is already finalized",11:"Object.defineProperty() cannot be used on an Immer draft",12:"Object.setPrototypeOf() cannot be used on an Immer draft",13:"Immer only supports deleting array indices",14:"Immer only supports setting array indices and the 'length' property",15:function(n){return "Cannot apply patch, path doesn't resolve: "+n},16:'Sets cannot have "replace" patches.',17:function(n){return "Unsupported patch operation: "+n},18:function(n){return "The plugin for '"+n+"' has not been loaded into Immer. To enable the plugin, import and call `enable"+n+"()` when initializing your application."},20:"Cannot use proxies if Proxy, Proxy.revocable or Reflect are not available",21:function(n){return "produce can only be called on things that are draftable: plain objects, arrays, Map, Set or classes that are marked with '[immerable]: true'. Got '"+n+"'"},22:function(n){return "'current' expects a draft, got: "+n},23:function(n){return "'original' expects a draft, got: "+n},24:"Patching reserved attributes like __proto__, prototype and constructor is not allowed"},Z=""+Object.prototype.constructor,nn="undefined"!=typeof Reflect&&Reflect.ownKeys?Reflect.ownKeys:void 0!==Object.getOwnPropertySymbols?function(n){return Object.getOwnPropertyNames(n).concat(Object.getOwnPropertySymbols(n))}:Object.getOwnPropertyNames,rn=Object.getOwnPropertyDescriptors||function(n){var r={};return nn(n).forEach((function(t){r[t]=Object.getOwnPropertyDescriptor(n,t);})),r},tn={},en={get:function(n,r){if(r===Q)return n;var e=p(n);if(!u(e,r))return function(n,r,t){var e,i=I(r,t);return i?"value"in i?i.value:null===(e=i.get)||void 0===e?void 0:e.call(n.k):void 0}(n,e,r);var i=e[r];return n.I||!t(i)?i:i===z(n.t,r)?(E(n),n.o[r]=R(n.A.h,i,n)):i},has:function(n,r){return r in p(n)},ownKeys:function(n){return Reflect.ownKeys(p(n))},set:function(n,r,t){var e=I(p(n),r);if(null==e?void 0:e.set)return e.set.call(n.k,t),!0;if(!n.P){var i=z(p(n),r),o=null==i?void 0:i[Q];if(o&&o.t===t)return n.o[r]=t,n.D[r]=!1,!0;if(c(t,i)&&(void 0!==t||u(n.t,r)))return !0;E(n),k(n);}return n.o[r]===t&&"number"!=typeof t&&(void 0!==t||r in n.o)||(n.o[r]=t,n.D[r]=!0,!0)},deleteProperty:function(n,r){return void 0!==z(n.t,r)||r in n.t?(n.D[r]=!1,E(n),k(n)):delete n.D[r],n.o&&delete n.o[r],!0},getOwnPropertyDescriptor:function(n,r){var t=p(n),e=Reflect.getOwnPropertyDescriptor(t,r);return e?{writable:!0,configurable:1!==n.i||"length"!==r,enumerable:e.enumerable,value:t[r]}:e},defineProperty:function(){n(11);},getPrototypeOf:function(n){return Object.getPrototypeOf(n.t)},setPrototypeOf:function(){n(12);}},on={};i(en,(function(n,r){on[n]=function(){return arguments[0]=arguments[0][0],r.apply(this,arguments)};})),on.deleteProperty=function(r,t){return "production"!==process.env.NODE_ENV&&isNaN(parseInt(t))&&n(13),on.set.call(this,r,t,void 0)},on.set=function(r,t,e){return "production"!==process.env.NODE_ENV&&"length"!==t&&isNaN(parseInt(t))&&n(14),en.set.call(this,r[0],t,e,r[0])};var un=function(){function e(r){var e=this;this.g=B,this.F=!0,this.produce=function(r,i,o){if("function"==typeof r&&"function"!=typeof i){var u=i;i=r;var a=e;return function(n){var r=this;void 0===n&&(n=u);for(var t=arguments.length,e=Array(t>1?t-1:0),o=1;o<t;o++)e[o-1]=arguments[o];return a.produce(n,(function(n){var t;return (t=i).call.apply(t,[r,n].concat(e))}))}}var f;if("function"!=typeof i&&n(6),void 0!==o&&"function"!=typeof o&&n(7),t(r)){var c=w(e),s=R(e,r,void 0),v=!0;try{f=i(s),v=!1;}finally{v?O(c):g(c);}return "undefined"!=typeof Promise&&f instanceof Promise?f.then((function(n){return j(c,o),P(n,c)}),(function(n){throw O(c),n})):(j(c,o),P(f,c))}if(!r||"object"!=typeof r){if(void 0===(f=i(r))&&(f=r),f===H&&(f=void 0),e.F&&d(f,!0),o){var p=[],l=[];b("Patches").M(r,f,p,l),o(p,l);}return f}n(21,r);},this.produceWithPatches=function(n,r){if("function"==typeof n)return function(r){for(var t=arguments.length,i=Array(t>1?t-1:0),o=1;o<t;o++)i[o-1]=arguments[o];return e.produceWithPatches(r,(function(r){return n.apply(void 0,[r].concat(i))}))};var t,i,o=e.produce(n,r,(function(n,r){t=n,i=r;}));return "undefined"!=typeof Promise&&o instanceof Promise?o.then((function(n){return [n,t,i]})):[o,t,i]},"boolean"==typeof(null==r?void 0:r.useProxies)&&this.setUseProxies(r.useProxies),"boolean"==typeof(null==r?void 0:r.autoFreeze)&&this.setAutoFreeze(r.autoFreeze);}var i=e.prototype;return i.createDraft=function(e){t(e)||n(8),r(e)&&(e=D(e));var i=w(this),o=R(this,e,void 0);return o[Q].C=!0,g(i),o},i.finishDraft=function(r,t){var e=r&&r[Q];"production"!==process.env.NODE_ENV&&(e&&e.C||n(9),e.I&&n(10));var i=e.A;return j(i,t),P(void 0,i)},i.setAutoFreeze=function(n){this.F=n;},i.setUseProxies=function(r){r&&!B&&n(20),this.g=r;},i.applyPatches=function(n,t){var e;for(e=t.length-1;e>=0;e--){var i=t[e];if(0===i.path.length&&"replace"===i.op){n=i.value;break}}e>-1&&(t=t.slice(e+1));var o=b("Patches").$;return r(n)?o(n,t):this.produce(n,(function(n){return o(n,t)}))},e}(),an=new un,fn=an.produce;an.produceWithPatches.bind(an);an.setAutoFreeze.bind(an);an.setUseProxies.bind(an);an.applyPatches.bind(an);an.createDraft.bind(an);an.finishDraft.bind(an);var createNextState2 = fn;

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);

  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    enumerableOnly && (symbols = symbols.filter(function (sym) {
      return Object.getOwnPropertyDescriptor(object, sym).enumerable;
    })), keys.push.apply(keys, symbols);
  }

  return keys;
}

function _objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = null != arguments[i] ? arguments[i] : {};
    i % 2 ? ownKeys(Object(source), !0).forEach(function (key) {
      _defineProperty(target, key, source[key]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) {
      Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
    });
  }

  return target;
}

/**
 * Adapted from React: https://github.com/facebook/react/blob/master/packages/shared/formatProdErrorMessage.js
 *
 * Do not require this module directly! Use normal throw error calls. These messages will be replaced with error codes
 * during build.
 * @param {number} code
 */
function formatProdErrorMessage(code) {
  return "Minified Redux error #" + code + "; visit https://redux.js.org/Errors?code=" + code + " for the full message or " + 'use the non-minified dev environment for full errors. ';
}

// Inlined version of the `symbol-observable` polyfill
var $$observable = (function () {
  return typeof Symbol === 'function' && Symbol.observable || '@@observable';
})();

/**
 * These are private action types reserved by Redux.
 * For any unknown actions, you must return the current state.
 * If the current state is undefined, you must return the initial state.
 * Do not reference these action types directly in your code.
 */
var randomString = function randomString() {
  return Math.random().toString(36).substring(7).split('').join('.');
};

var ActionTypes = {
  INIT: "@@redux/INIT" + randomString(),
  REPLACE: "@@redux/REPLACE" + randomString(),
  PROBE_UNKNOWN_ACTION: function PROBE_UNKNOWN_ACTION() {
    return "@@redux/PROBE_UNKNOWN_ACTION" + randomString();
  }
};

/**
 * @param {any} obj The object to inspect.
 * @returns {boolean} True if the argument appears to be a plain object.
 */
function isPlainObject$1(obj) {
  if (typeof obj !== 'object' || obj === null) return false;
  var proto = obj;

  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }

  return Object.getPrototypeOf(obj) === proto;
}

// Inlined / shortened version of `kindOf` from https://github.com/jonschlinkert/kind-of
function miniKindOf(val) {
  if (val === void 0) return 'undefined';
  if (val === null) return 'null';
  var type = typeof val;

  switch (type) {
    case 'boolean':
    case 'string':
    case 'number':
    case 'symbol':
    case 'function':
      {
        return type;
      }
  }

  if (Array.isArray(val)) return 'array';
  if (isDate(val)) return 'date';
  if (isError(val)) return 'error';
  var constructorName = ctorName(val);

  switch (constructorName) {
    case 'Symbol':
    case 'Promise':
    case 'WeakMap':
    case 'WeakSet':
    case 'Map':
    case 'Set':
      return constructorName;
  } // other


  return type.slice(8, -1).toLowerCase().replace(/\s/g, '');
}

function ctorName(val) {
  return typeof val.constructor === 'function' ? val.constructor.name : null;
}

function isError(val) {
  return val instanceof Error || typeof val.message === 'string' && val.constructor && typeof val.constructor.stackTraceLimit === 'number';
}

function isDate(val) {
  if (val instanceof Date) return true;
  return typeof val.toDateString === 'function' && typeof val.getDate === 'function' && typeof val.setDate === 'function';
}

function kindOf(val) {
  var typeOfVal = typeof val;

  if (process.env.NODE_ENV !== 'production') {
    typeOfVal = miniKindOf(val);
  }

  return typeOfVal;
}

/**
 * Creates a Redux store that holds the state tree.
 * The only way to change the data in the store is to call `dispatch()` on it.
 *
 * There should only be a single store in your app. To specify how different
 * parts of the state tree respond to actions, you may combine several reducers
 * into a single reducer function by using `combineReducers`.
 *
 * @param {Function} reducer A function that returns the next state tree, given
 * the current state tree and the action to handle.
 *
 * @param {any} [preloadedState] The initial state. You may optionally specify it
 * to hydrate the state from the server in universal apps, or to restore a
 * previously serialized user session.
 * If you use `combineReducers` to produce the root reducer function, this must be
 * an object with the same shape as `combineReducers` keys.
 *
 * @param {Function} [enhancer] The store enhancer. You may optionally specify it
 * to enhance the store with third-party capabilities such as middleware,
 * time travel, persistence, etc. The only store enhancer that ships with Redux
 * is `applyMiddleware()`.
 *
 * @returns {Store} A Redux store that lets you read the state, dispatch actions
 * and subscribe to changes.
 */

function createStore(reducer, preloadedState, enhancer) {
  var _ref2;

  if (typeof preloadedState === 'function' && typeof enhancer === 'function' || typeof enhancer === 'function' && typeof arguments[3] === 'function') {
    throw new Error(process.env.NODE_ENV === "production" ? formatProdErrorMessage(0) : 'It looks like you are passing several store enhancers to ' + 'createStore(). This is not supported. Instead, compose them ' + 'together to a single function. See https://redux.js.org/tutorials/fundamentals/part-4-store#creating-a-store-with-enhancers for an example.');
  }

  if (typeof preloadedState === 'function' && typeof enhancer === 'undefined') {
    enhancer = preloadedState;
    preloadedState = undefined;
  }

  if (typeof enhancer !== 'undefined') {
    if (typeof enhancer !== 'function') {
      throw new Error(process.env.NODE_ENV === "production" ? formatProdErrorMessage(1) : "Expected the enhancer to be a function. Instead, received: '" + kindOf(enhancer) + "'");
    }

    return enhancer(createStore)(reducer, preloadedState);
  }

  if (typeof reducer !== 'function') {
    throw new Error(process.env.NODE_ENV === "production" ? formatProdErrorMessage(2) : "Expected the root reducer to be a function. Instead, received: '" + kindOf(reducer) + "'");
  }

  var currentReducer = reducer;
  var currentState = preloadedState;
  var currentListeners = [];
  var nextListeners = currentListeners;
  var isDispatching = false;
  /**
   * This makes a shallow copy of currentListeners so we can use
   * nextListeners as a temporary list while dispatching.
   *
   * This prevents any bugs around consumers calling
   * subscribe/unsubscribe in the middle of a dispatch.
   */

  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners = currentListeners.slice();
    }
  }
  /**
   * Reads the state tree managed by the store.
   *
   * @returns {any} The current state tree of your application.
   */


  function getState() {
    if (isDispatching) {
      throw new Error(process.env.NODE_ENV === "production" ? formatProdErrorMessage(3) : 'You may not call store.getState() while the reducer is executing. ' + 'The reducer has already received the state as an argument. ' + 'Pass it down from the top reducer instead of reading it from the store.');
    }

    return currentState;
  }
  /**
   * Adds a change listener. It will be called any time an action is dispatched,
   * and some part of the state tree may potentially have changed. You may then
   * call `getState()` to read the current state tree inside the callback.
   *
   * You may call `dispatch()` from a change listener, with the following
   * caveats:
   *
   * 1. The subscriptions are snapshotted just before every `dispatch()` call.
   * If you subscribe or unsubscribe while the listeners are being invoked, this
   * will not have any effect on the `dispatch()` that is currently in progress.
   * However, the next `dispatch()` call, whether nested or not, will use a more
   * recent snapshot of the subscription list.
   *
   * 2. The listener should not expect to see all state changes, as the state
   * might have been updated multiple times during a nested `dispatch()` before
   * the listener is called. It is, however, guaranteed that all subscribers
   * registered before the `dispatch()` started will be called with the latest
   * state by the time it exits.
   *
   * @param {Function} listener A callback to be invoked on every dispatch.
   * @returns {Function} A function to remove this change listener.
   */


  function subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error(process.env.NODE_ENV === "production" ? formatProdErrorMessage(4) : "Expected the listener to be a function. Instead, received: '" + kindOf(listener) + "'");
    }

    if (isDispatching) {
      throw new Error(process.env.NODE_ENV === "production" ? formatProdErrorMessage(5) : 'You may not call store.subscribe() while the reducer is executing. ' + 'If you would like to be notified after the store has been updated, subscribe from a ' + 'component and invoke store.getState() in the callback to access the latest state. ' + 'See https://redux.js.org/api/store#subscribelistener for more details.');
    }

    var isSubscribed = true;
    ensureCanMutateNextListeners();
    nextListeners.push(listener);
    return function unsubscribe() {
      if (!isSubscribed) {
        return;
      }

      if (isDispatching) {
        throw new Error(process.env.NODE_ENV === "production" ? formatProdErrorMessage(6) : 'You may not unsubscribe from a store listener while the reducer is executing. ' + 'See https://redux.js.org/api/store#subscribelistener for more details.');
      }

      isSubscribed = false;
      ensureCanMutateNextListeners();
      var index = nextListeners.indexOf(listener);
      nextListeners.splice(index, 1);
      currentListeners = null;
    };
  }
  /**
   * Dispatches an action. It is the only way to trigger a state change.
   *
   * The `reducer` function, used to create the store, will be called with the
   * current state tree and the given `action`. Its return value will
   * be considered the **next** state of the tree, and the change listeners
   * will be notified.
   *
   * The base implementation only supports plain object actions. If you want to
   * dispatch a Promise, an Observable, a thunk, or something else, you need to
   * wrap your store creating function into the corresponding middleware. For
   * example, see the documentation for the `redux-thunk` package. Even the
   * middleware will eventually dispatch plain object actions using this method.
   *
   * @param {Object} action A plain object representing “what changed”. It is
   * a good idea to keep actions serializable so you can record and replay user
   * sessions, or use the time travelling `redux-devtools`. An action must have
   * a `type` property which may not be `undefined`. It is a good idea to use
   * string constants for action types.
   *
   * @returns {Object} For convenience, the same action object you dispatched.
   *
   * Note that, if you use a custom middleware, it may wrap `dispatch()` to
   * return something else (for example, a Promise you can await).
   */


  function dispatch(action) {
    if (!isPlainObject$1(action)) {
      throw new Error(process.env.NODE_ENV === "production" ? formatProdErrorMessage(7) : "Actions must be plain objects. Instead, the actual type was: '" + kindOf(action) + "'. You may need to add middleware to your store setup to handle dispatching other values, such as 'redux-thunk' to handle dispatching functions. See https://redux.js.org/tutorials/fundamentals/part-4-store#middleware and https://redux.js.org/tutorials/fundamentals/part-6-async-logic#using-the-redux-thunk-middleware for examples.");
    }

    if (typeof action.type === 'undefined') {
      throw new Error(process.env.NODE_ENV === "production" ? formatProdErrorMessage(8) : 'Actions may not have an undefined "type" property. You may have misspelled an action type string constant.');
    }

    if (isDispatching) {
      throw new Error(process.env.NODE_ENV === "production" ? formatProdErrorMessage(9) : 'Reducers may not dispatch actions.');
    }

    try {
      isDispatching = true;
      currentState = currentReducer(currentState, action);
    } finally {
      isDispatching = false;
    }

    var listeners = currentListeners = nextListeners;

    for (var i = 0; i < listeners.length; i++) {
      var listener = listeners[i];
      listener();
    }

    return action;
  }
  /**
   * Replaces the reducer currently used by the store to calculate the state.
   *
   * You might need this if your app implements code splitting and you want to
   * load some of the reducers dynamically. You might also need this if you
   * implement a hot reloading mechanism for Redux.
   *
   * @param {Function} nextReducer The reducer for the store to use instead.
   * @returns {void}
   */


  function replaceReducer(nextReducer) {
    if (typeof nextReducer !== 'function') {
      throw new Error(process.env.NODE_ENV === "production" ? formatProdErrorMessage(10) : "Expected the nextReducer to be a function. Instead, received: '" + kindOf(nextReducer));
    }

    currentReducer = nextReducer; // This action has a similiar effect to ActionTypes.INIT.
    // Any reducers that existed in both the new and old rootReducer
    // will receive the previous state. This effectively populates
    // the new state tree with any relevant data from the old one.

    dispatch({
      type: ActionTypes.REPLACE
    });
  }
  /**
   * Interoperability point for observable/reactive libraries.
   * @returns {observable} A minimal observable of state changes.
   * For more information, see the observable proposal:
   * https://github.com/tc39/proposal-observable
   */


  function observable() {
    var _ref;

    var outerSubscribe = subscribe;
    return _ref = {
      /**
       * The minimal observable subscription method.
       * @param {Object} observer Any object that can be used as an observer.
       * The observer object should have a `next` method.
       * @returns {subscription} An object with an `unsubscribe` method that can
       * be used to unsubscribe the observable from the store, and prevent further
       * emission of values from the observable.
       */
      subscribe: function subscribe(observer) {
        if (typeof observer !== 'object' || observer === null) {
          throw new Error(process.env.NODE_ENV === "production" ? formatProdErrorMessage(11) : "Expected the observer to be an object. Instead, received: '" + kindOf(observer) + "'");
        }

        function observeState() {
          if (observer.next) {
            observer.next(getState());
          }
        }

        observeState();
        var unsubscribe = outerSubscribe(observeState);
        return {
          unsubscribe: unsubscribe
        };
      }
    }, _ref[$$observable] = function () {
      return this;
    }, _ref;
  } // When a store is created, an "INIT" action is dispatched so that every
  // reducer returns their initial state. This effectively populates
  // the initial state tree.


  dispatch({
    type: ActionTypes.INIT
  });
  return _ref2 = {
    dispatch: dispatch,
    subscribe: subscribe,
    getState: getState,
    replaceReducer: replaceReducer
  }, _ref2[$$observable] = observable, _ref2;
}

/**
 * Prints a warning in the console if it exists.
 *
 * @param {String} message The warning message.
 * @returns {void}
 */
function warning(message) {
  /* eslint-disable no-console */
  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    console.error(message);
  }
  /* eslint-enable no-console */


  try {
    // This error was thrown as a convenience so that if you enable
    // "break on all exceptions" in your console,
    // it would pause the execution at this line.
    throw new Error(message);
  } catch (e) {} // eslint-disable-line no-empty

}

function getUnexpectedStateShapeWarningMessage(inputState, reducers, action, unexpectedKeyCache) {
  var reducerKeys = Object.keys(reducers);
  var argumentName = action && action.type === ActionTypes.INIT ? 'preloadedState argument passed to createStore' : 'previous state received by the reducer';

  if (reducerKeys.length === 0) {
    return 'Store does not have a valid reducer. Make sure the argument passed ' + 'to combineReducers is an object whose values are reducers.';
  }

  if (!isPlainObject$1(inputState)) {
    return "The " + argumentName + " has unexpected type of \"" + kindOf(inputState) + "\". Expected argument to be an object with the following " + ("keys: \"" + reducerKeys.join('", "') + "\"");
  }

  var unexpectedKeys = Object.keys(inputState).filter(function (key) {
    return !reducers.hasOwnProperty(key) && !unexpectedKeyCache[key];
  });
  unexpectedKeys.forEach(function (key) {
    unexpectedKeyCache[key] = true;
  });
  if (action && action.type === ActionTypes.REPLACE) return;

  if (unexpectedKeys.length > 0) {
    return "Unexpected " + (unexpectedKeys.length > 1 ? 'keys' : 'key') + " " + ("\"" + unexpectedKeys.join('", "') + "\" found in " + argumentName + ". ") + "Expected to find one of the known reducer keys instead: " + ("\"" + reducerKeys.join('", "') + "\". Unexpected keys will be ignored.");
  }
}

function assertReducerShape(reducers) {
  Object.keys(reducers).forEach(function (key) {
    var reducer = reducers[key];
    var initialState = reducer(undefined, {
      type: ActionTypes.INIT
    });

    if (typeof initialState === 'undefined') {
      throw new Error(process.env.NODE_ENV === "production" ? formatProdErrorMessage(12) : "The slice reducer for key \"" + key + "\" returned undefined during initialization. " + "If the state passed to the reducer is undefined, you must " + "explicitly return the initial state. The initial state may " + "not be undefined. If you don't want to set a value for this reducer, " + "you can use null instead of undefined.");
    }

    if (typeof reducer(undefined, {
      type: ActionTypes.PROBE_UNKNOWN_ACTION()
    }) === 'undefined') {
      throw new Error(process.env.NODE_ENV === "production" ? formatProdErrorMessage(13) : "The slice reducer for key \"" + key + "\" returned undefined when probed with a random type. " + ("Don't try to handle '" + ActionTypes.INIT + "' or other actions in \"redux/*\" ") + "namespace. They are considered private. Instead, you must return the " + "current state for any unknown actions, unless it is undefined, " + "in which case you must return the initial state, regardless of the " + "action type. The initial state may not be undefined, but can be null.");
    }
  });
}
/**
 * Turns an object whose values are different reducer functions, into a single
 * reducer function. It will call every child reducer, and gather their results
 * into a single state object, whose keys correspond to the keys of the passed
 * reducer functions.
 *
 * @param {Object} reducers An object whose values correspond to different
 * reducer functions that need to be combined into one. One handy way to obtain
 * it is to use ES6 `import * as reducers` syntax. The reducers may never return
 * undefined for any action. Instead, they should return their initial state
 * if the state passed to them was undefined, and the current state for any
 * unrecognized action.
 *
 * @returns {Function} A reducer function that invokes every reducer inside the
 * passed object, and builds a state object with the same shape.
 */


function combineReducers(reducers) {
  var reducerKeys = Object.keys(reducers);
  var finalReducers = {};

  for (var i = 0; i < reducerKeys.length; i++) {
    var key = reducerKeys[i];

    if (process.env.NODE_ENV !== 'production') {
      if (typeof reducers[key] === 'undefined') {
        warning("No reducer provided for key \"" + key + "\"");
      }
    }

    if (typeof reducers[key] === 'function') {
      finalReducers[key] = reducers[key];
    }
  }

  var finalReducerKeys = Object.keys(finalReducers); // This is used to make sure we don't warn about the same
  // keys multiple times.

  var unexpectedKeyCache;

  if (process.env.NODE_ENV !== 'production') {
    unexpectedKeyCache = {};
  }

  var shapeAssertionError;

  try {
    assertReducerShape(finalReducers);
  } catch (e) {
    shapeAssertionError = e;
  }

  return function combination(state, action) {
    if (state === void 0) {
      state = {};
    }

    if (shapeAssertionError) {
      throw shapeAssertionError;
    }

    if (process.env.NODE_ENV !== 'production') {
      var warningMessage = getUnexpectedStateShapeWarningMessage(state, finalReducers, action, unexpectedKeyCache);

      if (warningMessage) {
        warning(warningMessage);
      }
    }

    var hasChanged = false;
    var nextState = {};

    for (var _i = 0; _i < finalReducerKeys.length; _i++) {
      var _key = finalReducerKeys[_i];
      var reducer = finalReducers[_key];
      var previousStateForKey = state[_key];
      var nextStateForKey = reducer(previousStateForKey, action);

      if (typeof nextStateForKey === 'undefined') {
        var actionType = action && action.type;
        throw new Error(process.env.NODE_ENV === "production" ? formatProdErrorMessage(14) : "When called with an action of type " + (actionType ? "\"" + String(actionType) + "\"" : '(unknown type)') + ", the slice reducer for key \"" + _key + "\" returned undefined. " + "To ignore an action, you must explicitly return the previous state. " + "If you want this reducer to hold no value, you can return null instead of undefined.");
      }

      nextState[_key] = nextStateForKey;
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
    }

    hasChanged = hasChanged || finalReducerKeys.length !== Object.keys(state).length;
    return hasChanged ? nextState : state;
  };
}

/**
 * Composes single-argument functions from right to left. The rightmost
 * function can take multiple arguments as it provides the signature for
 * the resulting composite function.
 *
 * @param {...Function} funcs The functions to compose.
 * @returns {Function} A function obtained by composing the argument functions
 * from right to left. For example, compose(f, g, h) is identical to doing
 * (...args) => f(g(h(...args))).
 */
function compose() {
  for (var _len = arguments.length, funcs = new Array(_len), _key = 0; _key < _len; _key++) {
    funcs[_key] = arguments[_key];
  }

  if (funcs.length === 0) {
    return function (arg) {
      return arg;
    };
  }

  if (funcs.length === 1) {
    return funcs[0];
  }

  return funcs.reduce(function (a, b) {
    return function () {
      return a(b.apply(void 0, arguments));
    };
  });
}

/**
 * Creates a store enhancer that applies middleware to the dispatch method
 * of the Redux store. This is handy for a variety of tasks, such as expressing
 * asynchronous actions in a concise manner, or logging every action payload.
 *
 * See `redux-thunk` package as an example of the Redux middleware.
 *
 * Because middleware is potentially asynchronous, this should be the first
 * store enhancer in the composition chain.
 *
 * Note that each middleware will be given the `dispatch` and `getState` functions
 * as named arguments.
 *
 * @param {...Function} middlewares The middleware chain to be applied.
 * @returns {Function} A store enhancer applying the middleware.
 */

function applyMiddleware() {
  for (var _len = arguments.length, middlewares = new Array(_len), _key = 0; _key < _len; _key++) {
    middlewares[_key] = arguments[_key];
  }

  return function (createStore) {
    return function () {
      var store = createStore.apply(void 0, arguments);

      var _dispatch = function dispatch() {
        throw new Error(process.env.NODE_ENV === "production" ? formatProdErrorMessage(15) : 'Dispatching while constructing your middleware is not allowed. ' + 'Other middleware would not be applied to this dispatch.');
      };

      var middlewareAPI = {
        getState: store.getState,
        dispatch: function dispatch() {
          return _dispatch.apply(void 0, arguments);
        }
      };
      var chain = middlewares.map(function (middleware) {
        return middleware(middlewareAPI);
      });
      _dispatch = compose.apply(void 0, chain)(store.dispatch);
      return _objectSpread2(_objectSpread2({}, store), {}, {
        dispatch: _dispatch
      });
    };
  };
}

/*
 * This is a dummy function to check if the function name has been altered by minification.
 * If the function has been minified and NODE_ENV !== 'production', warn the user.
 */

function isCrushed() {}

if (process.env.NODE_ENV !== 'production' && typeof isCrushed.name === 'string' && isCrushed.name !== 'isCrushed') {
  warning('You are currently using minified code outside of NODE_ENV === "production". ' + 'This means that you are running a slower development build of Redux. ' + 'You can use loose-envify (https://github.com/zertosh/loose-envify) for browserify ' + 'or setting mode to production in webpack (https://webpack.js.org/concepts/mode/) ' + 'to ensure you have the correct code for your production build.');
}

/** A function that accepts a potential "extra argument" value to be injected later,
 * and returns an instance of the thunk middleware that uses that value
 */
function createThunkMiddleware(extraArgument) {
  // Standard Redux middleware definition pattern:
  // See: https://redux.js.org/tutorials/fundamentals/part-4-store#writing-custom-middleware
  var middleware = function middleware(_ref) {
    var dispatch = _ref.dispatch,
        getState = _ref.getState;
    return function (next) {
      return function (action) {
        // The thunk middleware looks for any functions that were passed to `store.dispatch`.
        // If this "action" is really a function, call it and return the result.
        if (typeof action === 'function') {
          // Inject the store's `dispatch` and `getState` methods, as well as any "extra arg"
          return action(dispatch, getState, extraArgument);
        } // Otherwise, pass the action down the middleware chain as usual


        return next(action);
      };
    };
  };

  return middleware;
}

var thunk = createThunkMiddleware(); // Attach the factory function so users can create a customized version
// with whatever "extra arg" they want to inject into their thunks

thunk.withExtraArgument = createThunkMiddleware;
var thunkMiddleware = thunk;

var __extends = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
(undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (undefined && undefined.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = function (obj, key, value) { return key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value: value }) : obj[key] = value; };
var __spreadValues = function (a, b) {
    for (var prop in b || (b = {}))
        if (__hasOwnProp.call(b, prop))
            __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
        for (var _i = 0, _c = __getOwnPropSymbols(b); _i < _c.length; _i++) {
            var prop = _c[_i];
            if (__propIsEnum.call(b, prop))
                __defNormalProp(a, prop, b[prop]);
        }
    return a;
};
var composeWithDevTools = typeof window !== "undefined" && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ : function () {
    if (arguments.length === 0)
        return void 0;
    if (typeof arguments[0] === "object")
        return compose;
    return compose.apply(null, arguments);
};
// src/isPlainObject.ts
function isPlainObject(value) {
    if (typeof value !== "object" || value === null)
        return false;
    var proto = Object.getPrototypeOf(value);
    if (proto === null)
        return true;
    var baseProto = proto;
    while (Object.getPrototypeOf(baseProto) !== null) {
        baseProto = Object.getPrototypeOf(baseProto);
    }
    return proto === baseProto;
}
// src/utils.ts
function getTimeMeasureUtils(maxDelay, fnName) {
    var elapsed = 0;
    return {
        measureTime: function (fn) {
            var started = Date.now();
            try {
                return fn();
            }
            finally {
                var finished = Date.now();
                elapsed += finished - started;
            }
        },
        warnIfExceeded: function () {
            if (elapsed > maxDelay) {
                console.warn(fnName + " took " + elapsed + "ms, which is more than the warning threshold of " + maxDelay + "ms. \nIf your state or actions are very large, you may want to disable the middleware as it might cause too much of a slowdown in development mode. See https://redux-toolkit.js.org/api/getDefaultMiddleware for instructions.\nIt is disabled in production builds, so you don't need to worry about that.");
            }
        }
    };
}
var MiddlewareArray = /** @class */ (function (_super) {
    __extends(MiddlewareArray, _super);
    function MiddlewareArray() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var _this = _super.apply(this, args) || this;
        Object.setPrototypeOf(_this, MiddlewareArray.prototype);
        return _this;
    }
    Object.defineProperty(MiddlewareArray, Symbol.species, {
        get: function () {
            return MiddlewareArray;
        },
        enumerable: false,
        configurable: true
    });
    MiddlewareArray.prototype.concat = function () {
        var arr = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            arr[_i] = arguments[_i];
        }
        return _super.prototype.concat.apply(this, arr);
    };
    MiddlewareArray.prototype.prepend = function () {
        var arr = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            arr[_i] = arguments[_i];
        }
        if (arr.length === 1 && Array.isArray(arr[0])) {
            return new (MiddlewareArray.bind.apply(MiddlewareArray, __spreadArray([void 0], arr[0].concat(this))))();
        }
        return new (MiddlewareArray.bind.apply(MiddlewareArray, __spreadArray([void 0], arr.concat(this))))();
    };
    return MiddlewareArray;
}(Array));
// src/immutableStateInvariantMiddleware.ts
var isProduction = process.env.NODE_ENV === "production";
var prefix = "Invariant failed";
function invariant(condition, message) {
    if (condition) {
        return;
    }
    if (isProduction) {
        throw new Error(prefix);
    }
    throw new Error(prefix + ": " + (message || ""));
}
function stringify(obj, serializer, indent, decycler) {
    return JSON.stringify(obj, getSerialize(serializer, decycler), indent);
}
function getSerialize(serializer, decycler) {
    var stack = [], keys = [];
    if (!decycler)
        decycler = function (_, value) {
            if (stack[0] === value)
                return "[Circular ~]";
            return "[Circular ~." + keys.slice(0, stack.indexOf(value)).join(".") + "]";
        };
    return function (key, value) {
        if (stack.length > 0) {
            var thisPos = stack.indexOf(this);
            ~thisPos ? stack.splice(thisPos + 1) : stack.push(this);
            ~thisPos ? keys.splice(thisPos, Infinity, key) : keys.push(key);
            if (~stack.indexOf(value))
                value = decycler.call(this, key, value);
        }
        else
            stack.push(value);
        return serializer == null ? value : serializer.call(this, key, value);
    };
}
function isImmutableDefault(value) {
    return typeof value !== "object" || value === null || typeof value === "undefined" || Object.isFrozen(value);
}
function trackForMutations(isImmutable, ignorePaths, obj) {
    var trackedProperties = trackProperties(isImmutable, ignorePaths, obj);
    return {
        detectMutations: function () {
            return detectMutations(isImmutable, ignorePaths, trackedProperties, obj);
        }
    };
}
function trackProperties(isImmutable, ignorePaths, obj, path) {
    if (ignorePaths === void 0) { ignorePaths = []; }
    if (path === void 0) { path = ""; }
    var tracked = { value: obj };
    if (!isImmutable(obj)) {
        tracked.children = {};
        for (var key in obj) {
            var childPath = path ? path + "." + key : key;
            if (ignorePaths.length && ignorePaths.indexOf(childPath) !== -1) {
                continue;
            }
            tracked.children[key] = trackProperties(isImmutable, ignorePaths, obj[key], childPath);
        }
    }
    return tracked;
}
function detectMutations(isImmutable, ignorePaths, trackedProperty, obj, sameParentRef, path) {
    if (ignorePaths === void 0) { ignorePaths = []; }
    if (sameParentRef === void 0) { sameParentRef = false; }
    if (path === void 0) { path = ""; }
    var prevObj = trackedProperty ? trackedProperty.value : void 0;
    var sameRef = prevObj === obj;
    if (sameParentRef && !sameRef && !Number.isNaN(obj)) {
        return { wasMutated: true, path: path };
    }
    if (isImmutable(prevObj) || isImmutable(obj)) {
        return { wasMutated: false };
    }
    var keysToDetect = {};
    for (var key in trackedProperty.children) {
        keysToDetect[key] = true;
    }
    for (var key in obj) {
        keysToDetect[key] = true;
    }
    for (var key in keysToDetect) {
        var childPath = path ? path + "." + key : key;
        if (ignorePaths.length && ignorePaths.indexOf(childPath) !== -1) {
            continue;
        }
        var result = detectMutations(isImmutable, ignorePaths, trackedProperty.children[key], obj[key], sameRef, childPath);
        if (result.wasMutated) {
            return result;
        }
    }
    return { wasMutated: false };
}
function createImmutableStateInvariantMiddleware(options) {
    if (options === void 0) { options = {}; }
    if (process.env.NODE_ENV === "production") {
        return function () { return function (next) { return function (action) { return next(action); }; }; };
    }
    var _c = options.isImmutable, isImmutable = _c === void 0 ? isImmutableDefault : _c, ignoredPaths = options.ignoredPaths, _d = options.warnAfter, warnAfter = _d === void 0 ? 32 : _d, ignore = options.ignore;
    ignoredPaths = ignoredPaths || ignore;
    var track = trackForMutations.bind(null, isImmutable, ignoredPaths);
    return function (_c) {
        var getState = _c.getState;
        var state = getState();
        var tracker = track(state);
        var result;
        return function (next) { return function (action) {
            var measureUtils = getTimeMeasureUtils(warnAfter, "ImmutableStateInvariantMiddleware");
            measureUtils.measureTime(function () {
                state = getState();
                result = tracker.detectMutations();
                tracker = track(state);
                invariant(!result.wasMutated, "A state mutation was detected between dispatches, in the path '" + (result.path || "") + "'.  This may cause incorrect behavior. (https://redux.js.org/style-guide/style-guide#do-not-mutate-state)");
            });
            var dispatchedAction = next(action);
            measureUtils.measureTime(function () {
                state = getState();
                result = tracker.detectMutations();
                tracker = track(state);
                result.wasMutated && invariant(!result.wasMutated, "A state mutation was detected inside a dispatch, in the path: " + (result.path || "") + ". Take a look at the reducer(s) handling the action " + stringify(action) + ". (https://redux.js.org/style-guide/style-guide#do-not-mutate-state)");
            });
            measureUtils.warnIfExceeded();
            return dispatchedAction;
        }; };
    };
}
// src/serializableStateInvariantMiddleware.ts
function isPlain(val) {
    var type = typeof val;
    return type === "undefined" || val === null || type === "string" || type === "boolean" || type === "number" || Array.isArray(val) || isPlainObject(val);
}
function findNonSerializableValue(value, path, isSerializable, getEntries, ignoredPaths) {
    if (path === void 0) { path = ""; }
    if (isSerializable === void 0) { isSerializable = isPlain; }
    if (ignoredPaths === void 0) { ignoredPaths = []; }
    var foundNestedSerializable;
    if (!isSerializable(value)) {
        return {
            keyPath: path || "<root>",
            value: value
        };
    }
    if (typeof value !== "object" || value === null) {
        return false;
    }
    var entries = getEntries != null ? getEntries(value) : Object.entries(value);
    var hasIgnoredPaths = ignoredPaths.length > 0;
    for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
        var _c = entries_1[_i], key = _c[0], nestedValue = _c[1];
        var nestedPath = path ? path + "." + key : key;
        if (hasIgnoredPaths && ignoredPaths.indexOf(nestedPath) >= 0) {
            continue;
        }
        if (!isSerializable(nestedValue)) {
            return {
                keyPath: nestedPath,
                value: nestedValue
            };
        }
        if (typeof nestedValue === "object") {
            foundNestedSerializable = findNonSerializableValue(nestedValue, nestedPath, isSerializable, getEntries, ignoredPaths);
            if (foundNestedSerializable) {
                return foundNestedSerializable;
            }
        }
    }
    return false;
}
function createSerializableStateInvariantMiddleware(options) {
    if (options === void 0) { options = {}; }
    if (process.env.NODE_ENV === "production") {
        return function () { return function (next) { return function (action) { return next(action); }; }; };
    }
    var _c = options.isSerializable, isSerializable = _c === void 0 ? isPlain : _c, getEntries = options.getEntries, _d = options.ignoredActions, ignoredActions = _d === void 0 ? [] : _d, _e = options.ignoredActionPaths, ignoredActionPaths = _e === void 0 ? ["meta.arg", "meta.baseQueryMeta"] : _e, _f = options.ignoredPaths, ignoredPaths = _f === void 0 ? [] : _f, _g = options.warnAfter, warnAfter = _g === void 0 ? 32 : _g, _h = options.ignoreState, ignoreState = _h === void 0 ? false : _h;
    return function (storeAPI) { return function (next) { return function (action) {
        if (ignoredActions.length && ignoredActions.indexOf(action.type) !== -1) {
            return next(action);
        }
        var measureUtils = getTimeMeasureUtils(warnAfter, "SerializableStateInvariantMiddleware");
        measureUtils.measureTime(function () {
            var foundActionNonSerializableValue = findNonSerializableValue(action, "", isSerializable, getEntries, ignoredActionPaths);
            if (foundActionNonSerializableValue) {
                var keyPath = foundActionNonSerializableValue.keyPath, value = foundActionNonSerializableValue.value;
                console.error("A non-serializable value was detected in an action, in the path: `" + keyPath + "`. Value:", value, "\nTake a look at the logic that dispatched this action: ", action, "\n(See https://redux.js.org/faq/actions#why-should-type-be-a-string-or-at-least-serializable-why-should-my-action-types-be-constants)", "\n(To allow non-serializable values see: https://redux-toolkit.js.org/usage/usage-guide#working-with-non-serializable-data)");
            }
        });
        var result = next(action);
        if (!ignoreState) {
            measureUtils.measureTime(function () {
                var state = storeAPI.getState();
                var foundStateNonSerializableValue = findNonSerializableValue(state, "", isSerializable, getEntries, ignoredPaths);
                if (foundStateNonSerializableValue) {
                    var keyPath = foundStateNonSerializableValue.keyPath, value = foundStateNonSerializableValue.value;
                    console.error("A non-serializable value was detected in the state, in the path: `" + keyPath + "`. Value:", value, "\nTake a look at the reducer(s) handling this action type: " + action.type + ".\n(See https://redux.js.org/faq/organizing-state#can-i-put-functions-promises-or-other-non-serializable-items-in-my-store-state)");
                }
            });
            measureUtils.warnIfExceeded();
        }
        return result;
    }; }; };
}
// src/getDefaultMiddleware.ts
function isBoolean(x) {
    return typeof x === "boolean";
}
function curryGetDefaultMiddleware() {
    return function curriedGetDefaultMiddleware(options) {
        return getDefaultMiddleware(options);
    };
}
function getDefaultMiddleware(options) {
    if (options === void 0) { options = {}; }
    var _c = options.thunk, thunk = _c === void 0 ? true : _c, _d = options.immutableCheck, immutableCheck = _d === void 0 ? true : _d, _e = options.serializableCheck, serializableCheck = _e === void 0 ? true : _e;
    var middlewareArray = new MiddlewareArray();
    if (thunk) {
        if (isBoolean(thunk)) {
            middlewareArray.push(thunkMiddleware);
        }
        else {
            middlewareArray.push(thunkMiddleware.withExtraArgument(thunk.extraArgument));
        }
    }
    if (process.env.NODE_ENV !== "production") {
        if (immutableCheck) {
            var immutableOptions = {};
            if (!isBoolean(immutableCheck)) {
                immutableOptions = immutableCheck;
            }
            middlewareArray.unshift(createImmutableStateInvariantMiddleware(immutableOptions));
        }
        if (serializableCheck) {
            var serializableOptions = {};
            if (!isBoolean(serializableCheck)) {
                serializableOptions = serializableCheck;
            }
            middlewareArray.push(createSerializableStateInvariantMiddleware(serializableOptions));
        }
    }
    return middlewareArray;
}
// src/configureStore.ts
var IS_PRODUCTION = process.env.NODE_ENV === "production";
function configureStore(options) {
    var curriedGetDefaultMiddleware = curryGetDefaultMiddleware();
    var _c = options || {}, _d = _c.reducer, reducer = _d === void 0 ? void 0 : _d, _e = _c.middleware, middleware = _e === void 0 ? curriedGetDefaultMiddleware() : _e, _f = _c.devTools, devTools = _f === void 0 ? true : _f, _g = _c.preloadedState, preloadedState = _g === void 0 ? void 0 : _g, _h = _c.enhancers, enhancers = _h === void 0 ? void 0 : _h;
    var rootReducer;
    if (typeof reducer === "function") {
        rootReducer = reducer;
    }
    else if (isPlainObject(reducer)) {
        rootReducer = combineReducers(reducer);
    }
    else {
        throw new Error('"reducer" is a required argument, and must be a function or an object of functions that can be passed to combineReducers');
    }
    var finalMiddleware = middleware;
    if (typeof finalMiddleware === "function") {
        finalMiddleware = finalMiddleware(curriedGetDefaultMiddleware);
        if (!IS_PRODUCTION && !Array.isArray(finalMiddleware)) {
            throw new Error("when using a middleware builder function, an array of middleware must be returned");
        }
    }
    if (!IS_PRODUCTION && finalMiddleware.some(function (item) { return typeof item !== "function"; })) {
        throw new Error("each middleware provided to configureStore must be a function");
    }
    var middlewareEnhancer = applyMiddleware.apply(void 0, finalMiddleware);
    var finalCompose = compose;
    if (devTools) {
        finalCompose = composeWithDevTools(__spreadValues({
            trace: !IS_PRODUCTION
        }, typeof devTools === "object" && devTools));
    }
    var storeEnhancers = [middlewareEnhancer];
    if (Array.isArray(enhancers)) {
        storeEnhancers = __spreadArray([middlewareEnhancer], enhancers);
    }
    else if (typeof enhancers === "function") {
        storeEnhancers = enhancers(storeEnhancers);
    }
    var composedEnhancer = finalCompose.apply(void 0, storeEnhancers);
    return createStore(rootReducer, preloadedState, composedEnhancer);
}
// src/createAction.ts
function createAction(type, prepareAction) {
    function actionCreator() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (prepareAction) {
            var prepared = prepareAction.apply(void 0, args);
            if (!prepared) {
                throw new Error("prepareAction did not return an object");
            }
            return __spreadValues(__spreadValues({
                type: type,
                payload: prepared.payload
            }, "meta" in prepared && { meta: prepared.meta }), "error" in prepared && { error: prepared.error });
        }
        return { type: type, payload: args[0] };
    }
    actionCreator.toString = function () { return "" + type; };
    actionCreator.type = type;
    actionCreator.match = function (action) { return action.type === type; };
    return actionCreator;
}
// src/mapBuilders.ts
function executeReducerBuilderCallback(builderCallback) {
    var actionsMap = {};
    var actionMatchers = [];
    var defaultCaseReducer;
    var builder = {
        addCase: function (typeOrActionCreator, reducer) {
            if (process.env.NODE_ENV !== "production") {
                if (actionMatchers.length > 0) {
                    throw new Error("`builder.addCase` should only be called before calling `builder.addMatcher`");
                }
                if (defaultCaseReducer) {
                    throw new Error("`builder.addCase` should only be called before calling `builder.addDefaultCase`");
                }
            }
            var type = typeof typeOrActionCreator === "string" ? typeOrActionCreator : typeOrActionCreator.type;
            if (type in actionsMap) {
                throw new Error("addCase cannot be called with two reducers for the same action type");
            }
            actionsMap[type] = reducer;
            return builder;
        },
        addMatcher: function (matcher, reducer) {
            if (process.env.NODE_ENV !== "production") {
                if (defaultCaseReducer) {
                    throw new Error("`builder.addMatcher` should only be called before calling `builder.addDefaultCase`");
                }
            }
            actionMatchers.push({ matcher: matcher, reducer: reducer });
            return builder;
        },
        addDefaultCase: function (reducer) {
            if (process.env.NODE_ENV !== "production") {
                if (defaultCaseReducer) {
                    throw new Error("`builder.addDefaultCase` can only be called once");
                }
            }
            defaultCaseReducer = reducer;
            return builder;
        }
    };
    builderCallback(builder);
    return [actionsMap, actionMatchers, defaultCaseReducer];
}
// src/createReducer.ts
function isStateFunction(x) {
    return typeof x === "function";
}
function createReducer(initialState, mapOrBuilderCallback, actionMatchers, defaultCaseReducer) {
    if (actionMatchers === void 0) { actionMatchers = []; }
    var _c = typeof mapOrBuilderCallback === "function" ? executeReducerBuilderCallback(mapOrBuilderCallback) : [mapOrBuilderCallback, actionMatchers, defaultCaseReducer], actionsMap = _c[0], finalActionMatchers = _c[1], finalDefaultCaseReducer = _c[2];
    var getInitialState;
    if (isStateFunction(initialState)) {
        getInitialState = function () { return createNextState2(initialState(), function () {
        }); };
    }
    else {
        var frozenInitialState_1 = createNextState2(initialState, function () {
        });
        getInitialState = function () { return frozenInitialState_1; };
    }
    function reducer(state, action) {
        if (state === void 0) { state = getInitialState(); }
        var caseReducers = __spreadArray([
            actionsMap[action.type]
        ], finalActionMatchers.filter(function (_c) {
            var matcher = _c.matcher;
            return matcher(action);
        }).map(function (_c) {
            var reducer2 = _c.reducer;
            return reducer2;
        }));
        if (caseReducers.filter(function (cr) { return !!cr; }).length === 0) {
            caseReducers = [finalDefaultCaseReducer];
        }
        return caseReducers.reduce(function (previousState, caseReducer) {
            if (caseReducer) {
                if (r(previousState)) {
                    var draft = previousState;
                    var result = caseReducer(draft, action);
                    if (typeof result === "undefined") {
                        return previousState;
                    }
                    return result;
                }
                else if (!t(previousState)) {
                    var result = caseReducer(previousState, action);
                    if (typeof result === "undefined") {
                        if (previousState === null) {
                            return previousState;
                        }
                        throw Error("A case reducer on a non-draftable value must not return undefined");
                    }
                    return result;
                }
                else {
                    return createNextState2(previousState, function (draft) {
                        return caseReducer(draft, action);
                    });
                }
            }
            return previousState;
        }, state);
    }
    reducer.getInitialState = getInitialState;
    return reducer;
}
// src/index.ts
N();

var login = {
    loggedIn: createAction('login/loggedIn'),
    loggedOut: createAction('login/loggedOut')
};

var reducer = createReducer({login: false}, {
  [login.loggedIn]: (state, action) => ({...state, login: true}),
  [login.loggedOut]: (state, action) => ({...state, login: false})
});

class loginButton extends s$1 {
    
    static styles = r$3`
        .login-button {
            padding: 0.7rem 1.4rem;
            font-weight: bold;
            font-size: 0.9rem;
            color: rgb(41, 41, 41);
            border: solid;
            border-width: 2px;
            box-shadow: rgba(0, 0, 0, 0.15) 0px 5px 15px;
            outline: none;
            cursor: pointer;
            background: white;
            margin-right: 2rem;
        }
        
        
        .login-button:hover {
            background-color: #45b3eb;
        }
        
        .login-button:active {
            background-color: #39ace7;
            -moz-transform: scale(0.95);
            -webkit-transform: scale(0.95);
            -o-transform: scale(0.95);
            -ms-transform: scale(0.95);
            transform: scale(0.95);
        }

        .login-button  {
            background-color: rgb(0, 154, 209);
            border: none;
            color: white;
            padding: 13px 31px;
            text-align: center;
            -webkit-box-shadow: 0 10px 30px 0 rgba(95,186,233,0.4);
            box-shadow: 0 10px 30px 0 rgba(95,186,233,0.4);
            -webkit-border-radius: 5px 5px 5px 5px;
            border-radius: 5px 5px 5px 5px;
            -webkit-transition: all 0.3s ease-in-out;
            -moz-transition: all 0.3s ease-in-out;
            -ms-transition: all 0.3s ease-in-out;
            -o-transition: all 0.3s ease-in-out;
            transition: all 0.3s ease-in-out;
        }

        #modal {
            --color-primary: #009579;
            --color-primary-dark: #007f67;
            --color-secondary: #252c6a;
            --color-error: #cc3333;
            --color-succes: #4bb544;
            --bord-radius: 15px;

            display: none; 
            position: fixed; 
            z-index: 3; 

            padding-top: 100px; 
            left: 0;
            top: 0;
            width: 100%; 
            height: 100%; 
            overflow: auto; 
            background-color: rgb(0,0,0); 
            background-color: rgba(0,0,0,0.4); 
        }
        
        .modal-content {
            background-color: #fefefe;
            margin: auto;
            border: 1px solid #888;
            width: fit-content;
            max-width: fit-content;
            border-radius: var(--bord-radius);
            animation: appear 201ms ease-in 1;
            display:flex;
            align-items: center;
            justify-content: center;

        }

        @keyframes appear {
            0%{
                opacity: 0;
                transform: translateY(-10px);
            }
        }

        .container {
            width: 400px;
            max-width: 400px;
            padding: 2rem;
            box-shadow: 0 0 40px rgba(0,0, 0, 0.2);
            border-radius: var(--bord-radius);
            background: #ffffff;
        }
        
        .container, .formInput, .formButton {
            font: 500 1rem 'Roboto', sans-serif;
        }
        
        
        .form > *:first-child {
            margin-top: 0;
        }
        
        .form > *:last-child {
            margin-bottom: 0;
        }

        .login-flex-container {
            display:flex;
            justify-content: space-between;
            flex-wrap: wrap;
        }

        .formTitle {
            font-size:1.6em;
        }
        
        .close {
            width: 30px;
            font-size: 20px;
            color: #c0c5cb;
            background-color: transparent;
            border: none;
        }

        .close:hover,
        .close:focus {
            color: #000;
            text-decoration: none;
            cursor: pointer;
        }
        
        .form__message {
            text-align: center;
            margin-bottom: 1rem;
        }
        
        .form__message-error {
            color: var(--color-error);
        }
        
        .form__message-success {
            color: var(--color-succes);
        }
        
        .formInputGroup {
            margin-bottom: 1rem;
        }
        
        .formInput {
            display: block;
            width: 100%;
            padding: 0.75rem;
            box-sizing: border-box;
            border-radius: var(--bord-radius);
            border: 1px solid #dddddd;
            outline: none;
            background: #eeeeee;
            transition: background 0.2s, border-color 0.2s;
        }
        
        .formInput:focus {
            border-color: var(--color-primary);
            background: #ffffff;
        }
        
        .formInputError {
            color: var(--color-error);
            border-color: var(--color-error);
        }
        
        .formInputErrorMessage {
            margin-top: 0.5rem;
            font-size: 0.85rem;
            color: var(--color-error);
        }

        .formButton {
            width: 100%;
            padding: 1rem 2rem;
            font-weight: bold;
            font-size: 1.1rem;
            color: #ffffff;
            border: none;
            border-radius: var(--bord-radius);
            outline: none;
            cursor: pointer;
            text-shadow:
            -1px -1px 0 #000,  
            1px -1px 0 #000,
            -1px 1px 0 #000,
            1px 1px 0 #000;
            background: #009ad1;;
            margin-bottom: 2%;
        }
        
        .formButton:hover {
            background: #0281a1;
        }
        
        .formButton:active {
            transform: scale(0.98);
        }
        
        .formText {
            text-align: center;
        }
        
        .formLink {
            color: var(--color-secondary);
            text-decoration: none;
            cursor: pointer;
        }
        
        .formLink:hover {
            text-decoration: underline;
        }

    `;

    

    constructor() {
        super();    
    
    }

    render() {
        return p$1`
        <section id = "modal-section" @click="${this._closeModalOutside}">

            <button class="login-button" @click="${this._twoFunctions}" ">Log In</button>

            <div id="modal" role="alertdialog">
                <div class="modal-content" role="alertdialog">
                    
                    <div class="modal-body" role="alertdialog">
                    
                        <div class="form container" id="login"name="login">

                            <div class="login-flex-container">
                                <p class="empty">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</p>
                                <h2 tabindex="0" class="formTitle">Log In</h2>
                                <button class="close" id="close-button" @click="${this._hideModal}" aria-label="Close knop" aria-labelledby="escape knop">✖</button>
                            </div>

                            <div class="form__message form__message-error"></div>

                            <div class="formInputGroup">
                                <input aria-label="Vul hier je email in" name="email" id="userEmail" type="email" class="formInput" autofocus placeholder="Email" value="cursus@cursus.hu.nl" required>
                                <div class="formInputErrorMessage"></div>
                            </div>

                            <div class="formInputGroup">
                                <input aria-label="Vul hier je wachtwoord in" name="password" id="password" type="password" class="formInput" placeholder="Password" autocomplete="on" value="cursus"required>
                                <div class="formInputErrorMessage"></div>
                            </div>

                            <button id="loginFormSubmit" class="formButton" type="submit" @click="${this._checkForLogin}">Login</button>

                            <p class="formText">
                                <a id="showMeAllCountriesTest" href="/" class="formLink">Wachtwoord vergeten</a>
                            </p>

                        </form>
                        
                    </div>
                </div
            </div>
        </section>
        `;
    }




    _twoFunctions() {
        this._focusAccessable();
        this._showModal();
    }

    _focusAccessable() {
        const focusableElements = 'h2, [href], input, select, textarea, button, [tabindex]:not([tabindex="-1"])';
        const modal = this.shadowRoot.querySelector('#modal');

        const firstFocusableElement = modal.querySelectorAll(focusableElements)[0]; 
        const focusableContent = modal.querySelectorAll(focusableElements);
        const lastFocusableElement = focusableContent[focusableContent.length - 1]; 

        let shadow = this.shadowRoot;

        document.addEventListener('keydown', function(e) {
            let isTabPressed = e.key === 'Tab' || e.keyCode === 9;

            if (!isTabPressed) {
                return;
            }

            if (e.shiftKey ) { 
                if (shadow.activeElement === firstFocusableElement) {
                    lastFocusableElement.focus();
                    e.preventDefault();
                }
            } else { 
                if (shadow.activeElement === lastFocusableElement) { 
                    firstFocusableElement.focus();
                    e.preventDefault();
                }
            }
        });
    }


    _checkForLogin() {
        const store = configureStore({
            reducer: reducer
          });
        
        var emailInput = this.shadowRoot.querySelector('#userEmail').value;
        var wachtwoordInput = this.shadowRoot.querySelector('#password').value;
        const messageElement = this.shadowRoot.querySelector(".form__message");
        // check is user is a cursuscoordinator
        if (emailInput == "cursus@cursus.hu.nl" && wachtwoordInput == "cursus") {
            store.dispatch(login.loggedIn());
            if(store.getState().login === true) {
                messageElement.textContent = "";
                messageElement.classList.remove("form__message--success", "form__message--error");
                window.location.href = "http://localhost:8000/";
                return console.log("INGELOGD, cursuscoordinator");
            }
        }

        // check is user is an examencoordinator
        if (emailInput == "examen@examen.hu.nl" && wachtwoordInput == "examen") {
            store.dispatch(login.loggedIn());
            if(store.getState().login === true) {
                messageElement.textContent = "";
                messageElement.classList.remove("form__message--success", "form__message--error");
                window.location.href = "http://localhost:8000/";
                return console.log("INGELOGD, examencoordinator");
            }
        }

        messageElement.textContent = "Verkeerde Email/Wachtwoord Combinatie";
        messageElement.classList.remove("form__message--success", "form__message--error");
        messageElement.classList.add(`form__message--error`);
    }


    _showModal() {
        var modalDiv = this.shadowRoot.querySelector('#modal');
        modalDiv.style.display = 'block';
    }

    _hideModal() {
        var modalDiv = this.shadowRoot.querySelector('#modal');
        modalDiv.style.display = 'none';
    }

    _closeModalOutside(event) {
        var modalDiv = this.shadowRoot.querySelector('#modal');
        if (event.target == modalDiv) {
            modalDiv.style.display = "none";
        }
    }
}

customElements.define('login-button', loginButton);

class signOut extends s$1 {

    static styles = r$3`
        .navbar {
            min-height:50px;
            background-color: white;
            padding: 0.8em;
            border-bottom: 0.1rem solid gainsboro;
            box-shadow: rgba(0, 0, 0, 0.05) 0px 5px 15px;
        }
        
        .container-navbar {
            display: flex;
            place-content: space-between;
        }
        
        .hu-logo {
            margin-left: 5%;
        }

        .loguit-button {
            padding: 0.7rem 1.4rem;
            font-weight: bold;
            font-size: 0.9rem;
            color: rgb(41, 41, 41);
            border: solid;
            border-width: 2px;
            box-shadow: rgba(0, 0, 0, 0.15) 0px 5px 15px;
            outline: none;
            cursor: pointer;
            background: white;
            margin-right: 2rem;
        }
        
        
        .loguit-button:hover {
            background-color: #45b3eb;
        }
        
        .loguit-button:active {
            background-color: #39ace7;
            -moz-transform: scale(0.95);
            -webkit-transform: scale(0.95);
            -o-transform: scale(0.95);
            -ms-transform: scale(0.95);
            transform: scale(0.95);
        }

        .loguit-button  {
            background-color: rgb(0, 154, 209);
            border: none;
            color: white;
            padding: 13px 31px;
            text-align: center;
            -webkit-box-shadow: 0 10px 30px 0 rgba(95,186,233,0.4);
            box-shadow: 0 10px 30px 0 rgba(95,186,233,0.4);
            -webkit-border-radius: 5px 5px 5px 5px;
            border-radius: 5px 5px 5px 5px;
            -webkit-transition: all 0.3s ease-in-out;
            -moz-transition: all 0.3s ease-in-out;
            -ms-transition: all 0.3s ease-in-out;
            -o-transition: all 0.3s ease-in-out;
            transition: all 0.3s ease-in-out;
        }
    `;

    constructor() {
        super();
    }

    render() {
        return p$1`
        <button class="loguit-button" @click="${this._signOut}">Loguit</button>
        `;
    }

    _signOut() {
        const store = configureStore({
            reducer: reducer
        });

        store.dispatch(login.loggedOut());
        
        if(store.getState().login === false) {
            window.location.href = "http://localhost:8000/student";
        }
    }
}

customElements.define('signout-button', signOut);

class footer extends s$1 {

    static styles = r$3`

    .container-footer {
        font-size: 0.8em;
        text-align: right;
        min-height:50px;
        background:rgb(51,51,51);
        color: white;
        padding: 1em 5em 1em 1em;
        margin: 0;
    `;

    constructor() {
        super();
    }

    render() {
        return p$1`
        <div class="footer-section">
            <div class="container-footer">
                <p>10.51.1797 | 08 december 2021 | © Hogeschool Utrecht</p>
            </div>
        </div>
        `;
    }
}

customElements.define('footer-component', footer);

class crudKoppeling extends s$1 {
 
    static styles = r$3`
        .crudbutton {
            padding: 0.8rem 1.5rem;
            font-weight: bold;
            font-size: 0.9rem;
            color: 0, 0, 0;
            border: none;
            border-radius: 15px;
            outline: none;
            cursor: pointer;
            background: rgb(171 171 171);
        }

        
        .crudbutton:hover {
            background: rgb(145 145 145);
        }
        
        .crudbutton:active {
            transform: scale(.98);
        }
    `;

    constructor() {
        super();
    }

    render() {
        return p$1` 
            <div tabindex="0">
                <button class="crudbutton" @click="${this.open}">
                    Nieuwe Bezem/Conversie/Cursus/Examen
                </button>   
            </div>
        `;
    }

    open(){
        window.location.href = "http://localhost:8000/crud-page";
    }
}

customElements.define('crud-koppeling', crudKoppeling);

class addConversieBezem extends s$1 {
 
    static styles = r$3`
        .container {
            border-radius: 5px;
            padding: 20px;
        }
        .row:after {
            content: "";
            display: table;
            clear: both;
        }
        .col-25 {
            font-size: 25px;
            float: left;
            width: 25%;
            margin-top: 6px;
        }
        
        .col-75 {
            font-size: 25px;
            float: left;
            width: 40%;
            margin-top: 6px;
        }
        .col-75 input {
            width: 100%;
            padding: 8px;
            border: 1px solid #CCC;
            border-radius: 2px;
            resize: vertical;
            text-align:left;
            font-size: 20px;
        }
        #submitbutton {
            padding: 0.8rem 1.5rem;
            font-weight: bold;
            font-size: 0.9rem;
            color: 0, 0, 0;
            border: none;
            border-radius: 15px;
            outline: none;
            cursor: pointer;
            background: rgb(171 171 171);
            margin-left: 1rem;
        }
        .back {
            margin-top: 10px;
            margin-left: 20px;
            padding: 0.8rem 1.5rem;
            font-weight: bold;
            font-size: 0.9rem;
            color: 0, 0, 0;
            border: none;
            border-radius: 15px;
            outline: none;
            cursor: pointer;
            background: rgb(171 171 171);
        }

        .inputselect {
            marging-left: 5px;
            padding: 0.8rem 1.5rem;
            font-weight: bold;
            font-size: 0.9rem;
            color: 0, 0, 0;
            border: none;
            border-radius: 15px;
            outline: none;
            cursor: pointer;
        }

        
        .back:hover {
            background: rgb(145 145 145);
        }
        
        .back:active {
            transform: scale(.98);
        }
    `;

    constructor() {
        super();
        this.conversionService = new ConversionService();
        this.courseService = new CourseService();
        this.examService = new ExamService();
    }

    render() {
        return p$1`
        <button class="back" @click="${this.BackToHomePage}">
            Terug
        </button>
        <form id="createConversieBezem">
            <div class="container">
            <form id="addConversie">
                <h1>Nieuwe conversie/bezem</h1>

                <fieldset>
                <legend>Oude Toets</legend>
                <div class="row">
                    <div class="col-25">
                        <label for="cursuscode">Cursuscode:</label>
                    </div>
                    <div class="col-75">
                        <input type="text" id="cursuscode" name="cursuscode" required>
                    </div>
                </div>
                <br>
                
                <div class="row">
                    <div class="col-25">
                        <label for="oudeexamentype">Oude examentype:</label>
                    </div>
                    <div class="col-75">
                        <input type="text" id="oudeexamentype" name="oudeexamentype" required>
                    </div>
                </div>
                <br>
                </fieldset>

                <fieldset>
                    <legend>Nieuwe Toets</legend>
                    <div class="row">
                        <div class="col-25">
                            <label for="examentype">Examen type:</label>
                        </div>
                        <div class="col-75">
                            <input type="text" id="examentype" name="examentype" required />
                        </div>
                    </div>
                    <br>
            
                    <div class="row">
                        <div class="col-25">
                            <label for="ecexamen">EC Examen:</label>
                        </div>
                        <div class="col-75">
                            <input type="number" id="ecexamen" name="EC" required />
                        </div>
                    </div>
                    <br>
            
                    <div class="row">
                        <div class="col-25">
                            <label for="wegingexamen">Weging:</label>
                        </div>
                        <div class="col-75">
                            <input type="number" id="wegingexamen" name="Weging" required />
                        </div>
                    </div>
                    <br>
            
                    <div class="row">
                        <div class="col-25">
                            <label for="coordinatorexamen">Coördinator:</label>
                        </div>
                        <div class="col-75">
                            <input type="text" id="coordinatorexamen" name="Coördinator" required />
                        </div>
                    </div>
                    <br>
                </fieldset>

                <br>
                <div class="row">
                    <div class="col-25">
                        <label for="examen">Conversie of Bezem:</label>
                    </div>
                    <div class="col-75">
                        <select class="inputselect" name="conversiebezem" id="conversiebezem" required>
                            <option value="Conversie">Conversie</option>
                            <option value="Bezem">Bezem</option>
                        </select>
                    </div>
                </div>
                <br>
                
                <div class="row">
                    <div class="col-25">
                        <label for="opmerking">Opmerking:</label>
                    </div>
                    <div class="col-75">
                        <input type="text" id="opmerking" name="opmerking" required />
                    </div>
                </div>
                <br>

                <div class="row">
                    <div class="col-25">
                        <label for="nieuwecode">Wat word de nieuwe Cursuscode?</label>
                    </div>
                    <div class="col-75">
                        <input type="text" id="nieuwecode" name="nieuwecode" required />
                    </div>
                </div>
                <br>

                <div class="row">
                    <div class="col-25">
                        <label for="nieuwenaam">Wat word de nieuwe Cursusnaam?</label>
                    </div>
                    <div class="col-75">
                        <input type="text" id="nieuwenaam" name="nieuwenaam" required />
                    </div>
                </div>
                <br>

                <div class="row">
                    <div class="col-25">
                        <label></label>
                    </div>
                    <div class="col-75">
                        <button id="submitbutton" @click="${this.submitConversie}">Maak nieuwe conversie/bezem aan</button>
                    </div>
                </div>
            </div>
            </div>
        </form>
        `;
    }

    submitConversie(event){
        event.preventDefault();
        let cursuscode = this.shadowRoot.getElementById('cursuscode').value;
        let oudeexamentype = this.shadowRoot.getElementById('oudeexamentype').value;
        let conversiebezem = this.shadowRoot.getElementById('conversiebezem').value;
        let examentype = this.shadowRoot.getElementById('examentype').value;
        let ecexamen = this.shadowRoot.getElementById('ecexamen').value;
        let wegingexamen = this.shadowRoot.getElementById('wegingexamen').value;
        let coordinatorexamen = this.shadowRoot.getElementById('coordinatorexamen').value;
        let opmerking = this.shadowRoot.getElementById('opmerking').value;
        let nieuwecode = this.shadowRoot.getElementById('nieuwecode').value;
        let nieuwenaam = this.shadowRoot.getElementById('nieuwenaam').value;
        
        let cursusObjects = [];
        let courses = this.courseService.getCourses();
        for (let course of courses){
            if (course.code === cursuscode){
                cursusObjects.push(course);
            }
        }
        if (cursusObjects.length !== 0){
            let oldCourse;
            let oudeExamen;
            if (cursusObjects.length > 1){
                for (let object of cursusObjects){
                    if (object['exams']['examType'] === oudeexamentype){
                        oldCourse = object;
                        oudeExamen = object['exams'];
                    }
                }
            }else {
                if (cursusObjects[0]['exams']['examType'] === oudeexamentype){
                    oldCourse = object;
                    oudeExamen = cursusObjects[0]['exams'];
                }
            }
            if (oudeExamen != null){
                if (examentype.length > 0){
                    console.log("erdoor?");
                    if (ecexamen.length > 0){
                        if (wegingexamen.length > 0){
                            if (coordinatorexamen.length > 0){
                                if (nieuwecode.length > 0){
                                    if (nieuwenaam.length > 0){
                                        const newExam = new Exam(examentype, ecexamen, wegingexamen, coordinatorexamen);
                                        this.examService.saveExam(newExam);
                                        const newCourse = new Course(cursusObjects[0].education, nieuwecode, nieuwenaam, cursusObjects[0].period, cursusObjects[0].ecCourse, newExam);
                                        this.courseService.saveCourse(newCourse);
                                        const conversion = new Conversion(conversiebezem, oldCourse, newCourse, opmerking, "crud");
                                        console.log(conversion);
                                        this.conversionService.saveConversion(conversion);
                                        this.conversionService.saveConversionToLocalStorage(conversion);
                                        alert("Succesvol conversie aangemaakt!");
                                    }else {alert("Vul een nieuwe cursusnaam in");}
                                }else {alert("Vul een nieuwe cursuscode in");}
                            }else {alert("Vul het veld 'Coördinator' in!");}
                        }else {alert("Vul het veld 'Weging' in!");}
                    }else {alert("Vul het veld 'EC Examen' in!");}
                }else {alert("Vul het veld 'Examen type' in!");}
            }else {alert("Er bestaat geen examen die bij de bovenstaande cursuscode hoort!");}
        }else {alert("Vul een geldige cursuscode in!");}
    }


    BackToHomePage(){
        window.location.href = "http://localhost:8000/";
    }

    
}

customElements.define('add-conversie-bezem', addConversieBezem);

class navbarCursus extends s$1 {

    static styles = r$3`
    .navbar {
        min-height:50px;
        background-color: white;
        padding: 0.8em;
        border-bottom: 0.1rem solid gainsboro;
        box-shadow: rgba(0, 0, 0, 0.05) 0px 5px 15px;
    }
    
    .container-navbar {
        display: flex;
        place-content: space-between;
    }
    
    .hu-logo {
        margin-left: 5%;
    }
    `;

    constructor() {
        super();
    }

    render() {
        return p$1`
        <div class="navbar">
            <div class="container-navbar">
                <img class="hu-logo" src="./src/images/HU-Logo.jpg" alt="HU logo">
                <signout-button></signout-button>
            </div>
        </div>
        `;
    }
}

customElements.define('nav-barcursus', navbarCursus);

class navbarStudent extends s$1 {

    static styles = r$3`
    .navbar {
        min-height:50px;
        background-color: white;
        padding: 0.8em;
        border-bottom: 0.1rem solid gainsboro;
        box-shadow: rgba(0, 0, 0, 0.05) 0px 5px 15px;
    }
    
    .container-navbar {
        display: flex;
        place-content: space-between;
    }
    
    .hu-logo {
        margin-left: 5%;
    }
    `;

    constructor() {
        super();
    }

    render() {
        return p$1`
        <div class="navbar">
            <div class="container-navbar">
                <img class="hu-logo" src="./src/images/HU-Logo.jpg" alt="HU logo">
                <login-button></login-button>
            </div>
        </div>
        `;
    }
}

customElements.define('nav-barstudent', navbarStudent);

class PageNotFound extends s$1 {
  static styles=r$3``;
  static properties = {};

  constructor() {
    super();
  }

  render() {
    return p$1`
      <h1>OEPS...</h1>
      <p>De pagina die je zocht kon niet gevonden worden</p>
    `;
  }
}

customElements.define('page-not-found', PageNotFound);

class studentPage extends s$1 {
  static styles = r$3`
    .body{
      min-height: 100vh;
      margin: 0;
      display: grid;
      grid-template-rows: auto auto 1fr auto;
      font: 500 1rem 'Roboto', sans-serif;
      background-color: whitesmoke;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      -khtml-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
    }
  `;
  static properties = {};

  constructor() {
    super();
  }

  render() {
    return p$1`
      <div class="body">
        <nav-barstudent></nav-barstudent>

        <table-nav></table-nav>

        <course-info-student></course-info-student>

        <footer-component></footer-component>
      </div>
    `;
  }
}

customElements.define('student-page', studentPage);

var studentPage$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  studentPage: studentPage
});

class cursuscoordinatorPage extends s$1 {
  static styles = r$3`
    .body{
      min-height: 100vh;
      margin: 0;
      display: grid;
      grid-template-rows: auto auto 1fr auto;
      font: 500 1rem 'Roboto', sans-serif;
      background-color: whitesmoke;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      -khtml-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
    }
  `;
  static properties = {};

  constructor() {
    super();
  }

  render() {
    return p$1`
      <div class="body">
        <nav-barcursus></nav-barcursus>

        <table-nav></table-nav>

        <course-info-cursus></course-info-cursus>

        <export-import-worker></export-import-worker>

        <footer-component></footer-component>
      </div>
    `;
  }
}

customElements.define('cursuscoordinator-page', cursuscoordinatorPage);

var cursuscoordinatorPage$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  cursuscoordinatorPage: cursuscoordinatorPage
});

class crudPage extends s$1 {
  static styles=r$3``;
  static properties = {};

  constructor() {
    super();
  }

  render() {
    return p$1`
        <div class="body">
          <nav-barcursus></nav-barcursus>

          <add-conversie-bezem></add-conversie-bezem>

          <footer-component></footer-component>
        </div>
    `;
  }
}

customElements.define('crud-page', crudPage);

var crudPage$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  crudPage: crudPage
});
