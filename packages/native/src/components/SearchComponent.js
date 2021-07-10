import React from 'react';
import { any, func, object, string, bool, number, arrayOf } from 'prop-types';
import {
  appbaseConfig as appbaseConfigDef,
  queryTypes,
  queryFormat as queryFormatDef,
  dataField as dataFieldDef,
  sortType,
  sourceFields,
  reactType,
  fuzziness as fuzzinessDef
} from '../utils/types';
import {
  getComponent,
  hasCustomRenderer,
  SearchContext
} from '../utils/helper';

class SearchComponent extends React.Component {
  static contextType = SearchContext;

  constructor(props, context) {
    super(props, context);
    this.state = {};
    const {
      id,
      index,
      url,
      credentials,
      headers,
      appbaseConfig,
      transformRequest,
      transformResponse,
      value,
      type,
      react,
      queryFormat,
      dataField,
      categoryField,
      categoryValue,
      nestedField,
      from,
      size,
      sortBy,
      aggregationField,
      aggregationSize,
      after,
      includeNullValues,
      includeFields,
      excludeFields,
      fuzziness,
      searchOperators,
      preserveResults,
      highlight,
      highlightField,
      customHighlight,
      interval,
      aggregations,
      missingLabel,
      showMissing,
      defaultQuery,
      customQuery,
      enableSynonyms,
      selectAllLabel,
      pagination,
      queryString,
      onValueChange,
      onResults,
      onAggregationData,
      onError,
      onRequestStatusChange,
      onQueryChange,
      onMicStatusChange,
      enablePopularSuggestions,
      maxPopularSuggestions,
      distinctField,
      distinctFieldConfig,
      enablePredictiveSuggestions
    } = this.props;
    // Register search base component
    context.register(id, {
      index,
      url,
      credentials,
      headers,
      appbaseConfig,
      transformRequest,
      transformResponse,
      value,
      type,
      react,
      queryFormat,
      dataField,
      categoryField,
      categoryValue,
      nestedField,
      from,
      size,
      sortBy,
      aggregationField,
      aggregationSize,
      after,
      includeNullValues,
      includeFields,
      excludeFields,
      fuzziness,
      searchOperators,
      highlight,
      highlightField,
      customHighlight,
      interval,
      aggregations,
      missingLabel,
      showMissing,
      defaultQuery,
      customQuery,
      enableSynonyms,
      selectAllLabel,
      pagination,
      queryString,
      onValueChange,
      onResults,
      onAggregationData,
      onError,
      onRequestStatusChange,
      onQueryChange,
      onMicStatusChange,
      enablePopularSuggestions,
      preserveResults,
      maxPopularSuggestions,
      distinctField,
      distinctFieldConfig,
      enablePredictiveSuggestions
    });
  }

  componentDidMount() {
    const { subscribeTo, triggerQueryOnInit } = this.props;

    // Subscribe to state changes
    if (this.hasCustomRenderer && this.componentInstance) {
      this.componentInstance.subscribeToStateChanges(change => {
        const state = {};
        Object.keys(change).forEach(property => {
          state[property] = change[property].next;
        });
        this.setState(state);
      }, subscribeTo);
    }
    if (triggerQueryOnInit && this.componentInstance) {
      this.componentInstance.triggerDefaultQuery();
    }
  }

  componentWillUnmount() {
    const { id, destroyOnUnmount } = this.props;
    if (destroyOnUnmount) {
      // unregister component
      this.context.unregister(id);
    }
  }

  get componentInstance() {
    const { id } = this.props;
    return this.context.getComponent(id);
  }

  get hasCustomRenderer() {
    return hasCustomRenderer(this.props);
  }

  render() {
    if (this.hasCustomRenderer && this.componentInstance) {
      return getComponent(this.componentInstance.mappedProps, this.props);
    }
    return null;
  }
}

SearchComponent.defaultProps = {
  // Triggers the default query on init
  triggerQueryOnInit: true,
  destroyOnUnmount: true,
  enablePredictiveSuggestions: false
};

SearchComponent.propTypes = {
  index: string,
  url: string,
  credentials: string,
  headers: object,
  appbaseConfig: appbaseConfigDef,
  transformRequest: func,
  transformResponse: func,
  beforeValueChange: func,
  enablePopularSuggestions: bool,
  maxPopularSuggestions: number,
  preserveResults: bool,
  // RS API properties
  // eslint-disable-next-line react/no-typos
  id: string.isRequired,
  value: any,
  type: queryTypes,
  react: reactType,
  queryFormat: queryFormatDef,
  dataField: dataFieldDef,
  categoryField: string,
  categoryValue: string,
  nestedField: string,
  from: number,
  size: number,
  sortBy: sortType,
  aggregationField: string,
  aggregationSize: number,
  after: object,
  includeNullValues: bool,
  includeFields: sourceFields,
  excludeFields: sourceFields,
  fuzziness: fuzzinessDef,
  searchOperators: bool,
  highlight: bool,
  highlightField: string,
  customHighlight: object,
  interval: number,
  aggregations: arrayOf(string),
  missingLabel: string,
  showMissing: bool,
  defaultQuery: func,
  customQuery: func,
  enableSynonyms: bool,
  selectAllLabel: string,
  pagination: bool,
  queryString: bool,
  render: func,
  distinctField: string,
  distinctFieldConfig: object,
  enablePredictiveSuggestions: bool,
  // subscribe on changes,
  subscribeTo: arrayOf(string),
  triggerQueryOnInit: bool,
  // event listeners
  // called when value changes
  onValueChange: func,

  // called when results change
  onResults: func,

  // called when composite aggregations change
  onAggregationData: func,

  // called when there is an error while fetching results
  onError: func,

  // called when request status changes
  onRequestStatusChange: func,

  // called when query changes
  onQueryChange: func,

  // called when mic status changes
  onMicStatusChange: func,

  // to destroy the component state
  destroyOnUnmount: bool
};

export default SearchComponent;
