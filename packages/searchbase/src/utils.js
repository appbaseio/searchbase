import type { DataField } from './types';

export function getErrorMessage(msg: string): string {
  return `SearchBase: ${msg}`;
}

export const errorMessages = {
  invalidIndex: getErrorMessage('Please provide a valid index.'),
  invalidURL: getErrorMessage('Please provide a valid url.'),
  invalidComponentId: getErrorMessage('Please provide component id.'),
  invalidDataField: getErrorMessage('Please provide data field.'),
  dataFieldAsArray: getErrorMessage(
    'Only components with `search` type supports the multiple data fields. Please define `dataField` as a string.'
  )
};

export const popularSuggestionFields = ['key', 'key.autosuggest'];

export const queryTypes = {
  Search: 'search',
  Term: 'term',
  Geo: 'geo',
  Range: 'range'
};

export const queryFormats = {
  Or: 'or',
  And: 'and'
};

export const sortOptions = {
  Asc: 'asc',
  Desc: 'desc',
  Count: 'count'
};

export const withClickIds = (results: Array<Object> = []): Array<Object> =>
  results.map((result, index) => ({
    ...result,
    _click_id: index + 1
  }));

export const highlightResults = (result: Object): Object => {
  const data = { ...result };
  if (data.highlight) {
    Object.keys(data.highlight).forEach(highlightItem => {
      const highlightValue = data.highlight[highlightItem][0];
      data._source = { ...data._source, [highlightItem]: highlightValue };
    });
  }
  return data;
};

export const parseHits = (hits: Array<Object>): Array<Object> => {
  let results: Array<Object> = [];
  if (hits) {
    results = [...hits].map(item => {
      const data = highlightResults(item);
      const result = Object.keys(data)
        .filter(key => key !== '_source')
        .reduce(
          (obj: { [key: string]: any }, key: string) => {
            // eslint-disable-next-line
            obj[key] = data[key];
            return obj;
          },
          {
            ...data._source
          }
        );
      return result;
    });
  }
  return results;
};

export const getNormalizedField = (
  field: string | Array<string | DataField>
): Array<string> => {
  if (field) {
    // if data field is string
    if (!Array.isArray(field)) {
      return [field];
    }
    if (field.length) {
      let fields = [];
      field.forEach(dataField => {
        if (typeof dataField === 'string') {
          fields.push(dataField);
        } else if (dataField.field) {
          // if data field is an array of objects
          fields.push(dataField.field);
        }
      });
      return fields;
    }
  }
  return undefined;
};

export function isNumber(n) {
  return !Number.isNaN(parseFloat(n)) && Number.isFinite(n);
}

export const getNormalizedWeights = (
  field: string | Array<string | DataField>
): Array<string> => {
  if (field && Array.isArray(field) && field.length) {
    let weights = [];
    field.forEach(dataField => {
      if (isNumber(dataField.weight)) {
        // if data field is an array of objects
        weights.push(dataField.weight);
      } else {
        // Add default weight as 1 to maintain order
        weights.push(1);
      }
    });
    return weights;
  }
  return undefined;
};

export function flatReactProp(reactProp: Object, componentID): Array<string> {
  let flattenReact = [];
  const flatReact = react => {
    if (react && Object.keys(react)) {
      Object.keys(react).forEach(r => {
        if (react[r]) {
          if (typeof react[r] === 'string') {
            flattenReact = [...flattenReact, react[r]];
          } else if (Array.isArray(react[r])) {
            flattenReact = [...flattenReact, ...react[r]];
          } else if (typeof react[r] === 'object') {
            flatReact(react[r]);
          }
        }
      });
    }
  };
  flatReact(reactProp);
  // Remove cyclic dependencies i.e dependencies on it's own
  flattenReact = flattenReact.filter(react => react !== componentID);
  return flattenReact;
}
// flattens a nested array
export const flatten = (arr: Array<any>) =>
  arr.reduce(
    (flat, toFlatten): Array<any> =>
      flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten),
    []
  );

// helper function to extract suggestions
export const extractSuggestion = (val: any) => {
  if (typeof val === 'object') {
    if (Array.isArray(val)) {
      return flatten(val);
    }
    return null;
  }
  return val;
};

/**
 *
 * @param {array} fields DataFields passed on Search Components
 * @param {array} suggestions Raw Suggestions received from ES
 * @param {string} currentValue Search Term
 * @param {boolean} showDistinctSuggestions When set to true will only return 1 suggestion per document
 * @param {boolean} enablePredictiveSuggestions When set to true will return the predictive suggestions list instead of the deafult list
 */
export const getSuggestions = (
  fields: Array<string> = [],
  suggestions: Array<Object>,
  value: string = '',
  showDistinctSuggestions: boolean = true,
  enablePredictiveSuggestions: boolean = false
) => {
  let suggestionsList = [];
  let labelsList = [];
  let skipWordMatch = false; //  Use to skip the word match logic, important for synonym
  const currentValue = value || '';
  const populateSuggestionsList = (val, parsedSource, source) => {
    // check if the suggestion includes the current value
    // and not already included in other suggestions
    const isWordMatch =
      skipWordMatch ||
      currentValue
        .trim()
        .split(' ')
        .some(term =>
          String(val)
            .toLowerCase()
            .includes(term)
        );
    // promoted results should always include in suggestions even there is no match
    if ((isWordMatch && !labelsList.includes(val)) || source._promoted) {
      const defaultOption = {
        label: val,
        value: val,
        source
      };
      const option = {
        ...defaultOption
      };
      labelsList = [...labelsList, val];
      suggestionsList = [...suggestionsList, option];

      if (showDistinctSuggestions) {
        return true;
      }
    }

    return false;
  };

  const parseField = (parsedSource, field = '', source = parsedSource) => {
    if (typeof parsedSource === 'object') {
      const fieldNodes = field.split('.');
      const label = parsedSource[fieldNodes[0]];
      if (label) {
        if (fieldNodes.length > 1) {
          // nested fields of the 'foo.bar.zoo' variety
          const children = field.substring(fieldNodes[0].length + 1);
          if (Array.isArray(label)) {
            label.forEach(arrayItem => {
              parseField(arrayItem, children, source);
            });
          } else {
            parseField(label, children, source);
          }
        } else {
          const val = extractSuggestion(label);
          if (val) {
            if (Array.isArray(val)) {
              if (showDistinctSuggestions) {
                return val.some(suggestion =>
                  populateSuggestionsList(suggestion, parsedSource, source)
                );
              }
              val.forEach(suggestion =>
                populateSuggestionsList(suggestion, parsedSource, source)
              );
            }
            return populateSuggestionsList(val, parsedSource, source);
          }
        }
      }
    }
    return false;
  };

  const traverseSuggestions = () => {
    if (showDistinctSuggestions) {
      suggestions.forEach(item => {
        fields.some(field => parseField(item, field));
      });
    } else {
      suggestions.forEach(item => {
        fields.forEach(field => {
          parseField(item, field);
        });
      });
    }
  };

  traverseSuggestions();

  if (suggestionsList.length < suggestions.length && !skipWordMatch) {
    /*
			When we have synonym we set skipWordMatch to false as it may discard
			the suggestion if word doesnt match term.
			For eg: iphone, ios are synonyms and on searching iphone isWordMatch
			in  populateSuggestionList may discard ios source which decreases no.
			of items in suggestionsList
		*/
    skipWordMatch = true;
    traverseSuggestions();
  }

  const getPredictiveSuggestions = ({
    predictiveSuggestions,
    currentValuePredictive,
    wordsToShowAfterHighlight
  }) => {
    const suggestionMap = {};
    const currentValuePredictiveTrimmed = currentValuePredictive.trim();
    if (currentValuePredictiveTrimmed) {
      const parsedSuggestion = predictiveSuggestions.reduce(
        (agg, { label, ...rest }) => {
          let parsedContent = label;
          // to handle special strings with pattern '<mark>xyz</mark> <a href="test'
          if (window.document) {
            parsedContent = new DOMParser().parseFromString(label, 'text/html')
              .documentElement.textContent;
          }

          // to match the partial start of word.
          // example if searchTerm is `select` and string contains `selected`
          let regexString = `^(${currentValuePredictiveTrimmed})\\w+`;
          let regex = new RegExp(regexString, 'i');
          let regexExecution = regex.exec(parsedContent);
          // if execution value is null it means either there is no match or there are chances
          // that exact word is present
          if (!regexExecution) {
            // regex to match exact word
            regexString = `^(${currentValuePredictiveTrimmed})`;
            regex = new RegExp(regexString, 'i');
            regexExecution = regex.exec(parsedContent);
          }

          if (regexExecution) {
            const matchedString = parsedContent.slice(
              regexExecution.index,
              parsedContent.length
            );

            const suggestionPhrase = `${currentValuePredictiveTrimmed}<mark class="highlight-class">${matchedString
              .slice(currentValuePredictiveTrimmed.length)
              .split(' ')
              .slice(0, wordsToShowAfterHighlight + 1)
              .join(' ')}</mark>`;

            // to show unique results only
            if (!suggestionMap[suggestionPhrase]) {
              suggestionMap[suggestionPhrase] = 1;
              return [
                ...agg,
                {
                  label: suggestionPhrase,
                  isPredictiveSuggestion: true,
                  ...rest
                }
              ];
            }

            return agg;
          }

          return agg;
        },
        []
      );

      return parsedSuggestion;
    }

    return [];
  };

  if (enablePredictiveSuggestions) {
    return getPredictiveSuggestions({
      predictiveSuggestions: suggestionsList,
      currentValuePredictive: value,
      wordsToShowAfterHighlight: true
    });
  }
  return suggestionsList;
};

export function parseCompAggToHits(
  aggFieldName: string,
  buckets?: Array<Object> = []
): Array<Object> {
  return buckets.map(bucket => {
    // eslint-disable-next-line camelcase
    const { doc_count, key, [aggFieldName]: data } = bucket;
    return {
      _doc_count: doc_count,
      // To handle the aggregation results for term and composite aggs
      _key: key[aggFieldName] !== undefined ? key[aggFieldName] : key,
      ...data
    };
  });
}

export function isEqual(x, y): boolean {
  if (x === y) return true;
  if (!(x instanceof Object) || !(y instanceof Object)) return false;
  if (x.constructor !== y.constructor) return false;

  /* eslint-disable */
  for (const p in x) {
    if (!x.hasOwnProperty(p)) continue;
    if (!y.hasOwnProperty(p)) return false;
    if (x[p] === y[p]) continue;
    if (typeof x[p] !== 'object') return false;
    if (!isEqual(x[p], y[p])) return false;
  }

  for (const p in y) {
    if (y.hasOwnProperty(p) && !x.hasOwnProperty(p)) return false;
  }
  /* eslint-enable */
  return true;
}

export const searchBaseMappings = {
  id: 'id',
  type: 'type',
  react: 'react',
  queryFormat: 'queryFormat',
  dataField: 'dataField',
  categoryField: 'categoryField',
  categoryValue: 'categoryValue',
  nestedField: 'nestedField',
  from: 'from',
  size: 'size',
  sortBy: 'sortBy',
  value: 'value',
  aggregationField: 'aggregationField',
  aggregationSize: 'aggregationSize',
  after: 'after',
  includeNullValues: 'includeNullValues',
  includeFields: 'includeFields',
  excludeFields: 'excludeFields',
  fuzziness: 'fuzziness',
  searchOperators: 'searchOperators',
  highlight: 'highlight',
  highlightField: 'highlightField',
  customHighlight: 'customHighlight',
  interval: 'interval',
  aggregations: 'aggregations',
  missingLabel: 'missingLabel',
  showMissing: 'showMissing',
  enableSynonyms: 'enableSynonyms',
  selectAllLabel: 'selectAllLabel',
  pagination: 'pagination',
  queryString: 'queryString',
  enablePopularSuggestions: 'enablePopularSuggestions',
  showDistinctSuggestions: 'showDistinctSuggestions',
  error: 'error',
  defaultQuery: 'defaultQuery',
  customQuery: 'customQuery',
  requestStatus: 'requestStatus',
  results: 'results',
  aggregationData: 'aggregationData',
  micStatus: 'micStatus',
  micInstance: 'micInstance',
  micActive: 'micActive',
  micInactive: 'micInactive',
  micDenied: 'micDenied',
  query: 'query',
  requestPending: 'loading',
  appbaseSettings: 'appbaseConfig',
  suggestions: 'suggestions',
  queryId: 'queryId',
  recentSearches: 'recentSearches',
  distinctField: 'distinctField',
  distinctFieldConfig: 'distinctFieldConfig',
  // ---------------- Methods -----------------------
  onMicClick: 'handleMicClick',
  triggerDefaultQuery: 'triggerDefaultQuery',
  triggerCustomQuery: 'triggerCustomQuery',
  recordClick: 'recordClick',
  recordConversions: 'recordConversions',
  subscribeToStateChanges: 'subscribeToStateChanges',
  unsubscribeToStateChanges: 'unsubscribeToStateChanges',
  // ---------------- Setter Methods ----------------
  setDataField: 'setDataField',
  setValue: 'setValue',
  setSize: 'setSize',
  setFrom: 'setFrom',
  setFuzziness: 'setFuzziness',
  setIncludeFields: 'setIncludeFields',
  setExcludeFields: 'setExcludeFields',
  setSortBy: 'setSortBy',
  setReact: 'setReact',
  setDefaultQuery: 'setDefaultQuery',
  setCustomQuery: 'setCustomQuery',
  setAfter: 'setAfter'
};

export function btoa(input = '') {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const str = input;
  let output = '';

  // eslint-disable-next-line
  for (
    let block = 0, charCode, i = 0, map = chars;
    str.charAt(i | 0) || ((map = '='), i % 1); // eslint-disable-line no-bitwise
    output += map.charAt(63 & (block >> (8 - (i % 1) * 8))) // eslint-disable-line no-bitwise
  ) {
    charCode = str.charCodeAt((i += 3 / 4));

    if (charCode > 0xff) {
      throw new Error(
        '"btoa" failed: The string to be encoded contains characters outside of the Latin1 range.'
      );
    }

    block = (block << 8) | charCode; // eslint-disable-line no-bitwise
  }

  return output;
}
