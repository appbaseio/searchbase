/** @jsx jsx */
import { jsx } from '@emotion/core';
import React from 'react';
import {
  appbaseConfig as appbaseConfigDef,
  any,
  bool,
  func,
  fuzziness as fuzzinessDef,
  highlightField,
  number,
  object,
  position,
  queryFormat,
  string,
  suggestions as suggestionsDef,
  title as titleDef,
  wholeNumber,
  dataFieldValidator,
  element,
  array
} from '../utils/types';
import SearchComponent from './SearchComponent';
import InputGroup from '../styles/InputGroup';
import InputAddon from '../styles/InputAddon';
import InputWrapper from '../styles/InputWrapper';
import Input from '../styles/Input';
import Title from '../styles/Title';
import {
  debounce as debounceFunc,
  equals,
  getClassName,
  getComponent,
  getPopularSuggestionsComponent,
  hasCustomRenderer,
  hasPopularSuggestionsRenderer,
  isEmpty,
  isFunction,
  isNumeric,
  parseFocusShortcuts,
  SearchContext,
  isHotkeyCombinationUsed,
  isModifierKeyUsed,
  extractModifierKeysFromFocusShortcuts
} from '../utils/helper';
import Downshift from 'downshift';
import Icons from './Icons';
import SuggestionItem from '../addons/SuggestionItem';
import {
  suggestions as suggestionsCss,
  suggestionsContainer
} from '../styles/Suggestions';
import SuggestionWrapper from '../addons/SuggestionsWrapper';
import causes from '../utils/causes';
import CustomSvg from '../styles/CustomSvg';

class SearchBox extends React.Component {
  static contextType = SearchContext;

  constructor(props, context) {
    super(props, context);
    const { value, defaultValue, focusShortcuts } = props;
    let currentValue = value || defaultValue || '';
    this.searchInputField = React.createRef();
    this.state = {
      isOpen: false
    };
    // Set the value in searchbase instance
    if (currentValue) {
      this.componentInstance.setValue(currentValue, {
        triggerDefaultQuery: false,
        triggerCustomQuery: true,
        stateChanges: true
      });
    }

    // dynamically import hotkey-js
    if (!isEmpty(focusShortcuts)) {
      this.shouldUtilizeHotkeysLib =
        isHotkeyCombinationUsed(focusShortcuts) ||
        isModifierKeyUsed(focusShortcuts);
      if (this.shouldUtilizeHotkeysLib) {
        try {
          // eslint-disable-next-line
          this.hotkeys = require('hotkeys-js').default;
        } catch (error) {
          // eslint-disable-next-line
          console.warn(
            'Warning(SearchBox): The `hotkeys-js` library seems to be missing, it is required when using key combinations( eg: `ctrl+a`) in focusShortcuts prop.'
          );
        }
      }
    }
  }

  componentDidMount() {
    document.addEventListener('keydown', this.onKeyDown);
    this.registerHotkeysListener();
    const {
      enableRecentSearches,
      autosuggest,
      aggregationField,
      maxRecentSearches
    } = this.props;
    if (aggregationField) {
      // eslint-disable-next-line no-console
      console.warn(
        'Warning(SearchBox): The `aggregationField` prop has been marked as deprecated, please use the `distinctField` prop instead.'
      );
    }
    if (enableRecentSearches && autosuggest) {
      this.componentInstance.getRecentSearches({
        size: maxRecentSearches || 5,
        minChars: 3
      });
    }
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onKeyDown);
  }

  componentDidUpdate(prevProps) {
    const {
      dataField,
      headers,
      fuzziness,
      nestedField,
      appbaseConfig
    } = this.props;
    this._applySetter(prevProps.dataField, dataField, 'setDataField');
    this._applySetter(prevProps.headers, headers, 'setHeaders');
    this._applySetter(prevProps.fuzziness, fuzziness, 'setFuzziness');
    this._applySetter(prevProps.nestedField, nestedField, 'setNestedField');
    if (
      JSON.stringify(prevProps.appbaseConfig) !== JSON.stringify(appbaseConfig)
    ) {
      if (this.componentInstance)
        this.componentInstance.appbaseConfig = appbaseConfig;
    }
  }

  get componentInstance() {
    const { id } = this.props;
    return this.context.getComponent(id);
  }

  get popularSuggestionsList() {
    const suggestions = this.componentInstance.suggestions;
    return (suggestions || []).filter(
      suggestion => suggestion.source._popular_suggestion
    );
  }

  get suggestionsList() {
    const { defaultSuggestions } = this.props;
    if (!this.componentInstance.value && defaultSuggestions) {
      return defaultSuggestions;
    }
    if (!this.componentInstance.value) {
      return [];
    }
    const suggestions = this.componentInstance.suggestions;
    return (suggestions || []).filter(
      suggestion => !suggestion.source._popular_suggestion
    );
  }

  get stats() {
    const total = this.componentInstance.results.numberOfResults;
    const { time, hidden, promotedData } = this.componentInstance.results;
    const size = this.props.size || 10;
    return {
      numberOfResults: total,
      ...(size > 0 ? { numberOfPages: Math.ceil(total / size) } : null),
      time,
      hidden,
      promoted: promotedData && promotedData.length
    };
  }

  _applySetter = (prev, next, setterFunc) => {
    if (!equals(prev, next))
      this.componentInstance && this.componentInstance[setterFunc](next);
  };

  getComponent = (downshiftProps = {}, isPopularSuggestionsRender = false) => {
    const { error, loading } = this.props;
    const data = {
      error,
      loading,
      downshiftProps,
      data: this.suggestionsList,
      value: this.componentInstance.value,
      triggerClickAnalytics: this.triggerClickAnalytics,
      promotedData: this.componentInstance.results.promotedData,
      customData: this.componentInstance.results.customData,
      resultStats: this.stats,
      rawData: this.componentInstance.results.rawData,
      popularSuggestions: this.popularSuggestionsList,
      recentSearches: this.componentInstance.recentSearches
    };
    if (isPopularSuggestionsRender) {
      return getPopularSuggestionsComponent(
        {
          downshiftProps,
          data: this.popularSuggestionsList,
          value: this.componentInstance.value,
          loading,
          error
        },
        this.props
      );
    }
    return getComponent(data, this.props);
  };

  triggerClickAnalytics = (clickPosition, isSuggestion = true, value) => {
    const { appbaseConfig } = this.props;
    if (
      !(appbaseConfig && appbaseConfig.recordAnalytics) ||
      !this.componentInstance
    )
      return;
    this.componentInstance.recordClick(
      { [value]: clickPosition },
      isSuggestion
    );
  };

  get hasCustomRenderer() {
    return hasCustomRenderer(this.props);
  }

  withTriggerQuery = cb => {
    if (cb) {
      return e => cb(this.componentInstance, e);
    }
    return undefined;
  };

  triggerQuery = () => {
    this.componentInstance &&
      this.componentInstance.setValue(this.props.value, {
        triggerCustomQuery: true,
        stateChanges: true
      });
  };

  triggerCustomQuery = () => {
    if (this.componentInstance) {
      this.componentInstance.triggerCustomQuery();
    }
  };

  triggerDefaultQuery = () => {
    this.componentInstance && this.componentInstance.triggerDefaultQuery();
  };

  onInputChange = event => {
    this.setValue({ value: event.target.value, event });
  };

  isControlled = () => {
    const { value, onChange } = this.props;
    if (value !== undefined && onChange) {
      return true;
    }
    return false;
  };

  setValue = ({ value, isOpen = true, ...rest }) => {
    const {
      onChange,
      debounce,
      enableRecentSearches,
      autosuggest,
      maxRecentSearches
    } = this.props;
    if (
      enableRecentSearches &&
      !value &&
      this.componentInstance.value &&
      autosuggest
    ) {
      this.componentInstance.getRecentSearches({
        size: maxRecentSearches || 5,
        minChars: 3
      });
    }
    this.setState({ isOpen });
    if (this.isControlled()) {
      this.componentInstance.setValue(value, {
        triggerDefaultQuery: false,
        triggerCustomQuery: false
      });
      onChange(value, this.componentInstance, rest.event);
    } else if (debounce > 0) {
      this.componentInstance.setValue(value, {
        triggerDefaultQuery: false,
        triggerCustomQuery: false,
        stateChanges: true
      });
      if (autosuggest) {
        // Clear results for empty query
        if (value) {
          debounceFunc(this.triggerDefaultQuery, debounce);
        } else {
          this.componentInstance.clearResults();
        }
      } else {
        debounceFunc(this.triggerCustomQuery, debounce);
      }
      if (rest.triggerCustomQuery) {
        this.triggerCustomQuery();
      }
    } else {
      if (value) {
        this.componentInstance.setValue(value, {
          triggerCustomQuery: rest.triggerCustomQuery,
          triggerDefaultQuery: !!autosuggest,
          stateChanges: true
        });
      } else {
        this.componentInstance.setValue(value, {
          triggerCustomQuery: rest.triggerCustomQuery,
          triggerDefaultQuery: false,
          stateChanges: true
        });
      }

      if (!autosuggest) {
        this.triggerCustomQuery();
      }
    }
  };

  onValueSelected = (currentValue = this.componentInstance.value, ...cause) => {
    const { onValueSelected } = this.props;
    if (onValueSelected) {
      onValueSelected(currentValue, ...cause);
    }
  };

  getBackgroundColor = (highlightedIndex, index) =>
    highlightedIndex === index ? '#eee' : '#fff';

  handleSearchIconClick = () => {
    const currentValue = this.componentInstance.value;
    if (currentValue.trim()) {
      this.setValue({
        value: currentValue,
        isOpen: false,
        triggerCustomQuery: true
      });
      this.onValueSelected(currentValue, causes.SEARCH_ICON_CLICK);
    }
  };

  clearValue = () => {
    this.setValue({ value: '', isOpen: false, triggerCustomQuery: true });
    this.onValueSelected(null, causes.CLEAR_VALUE);
  };

  onSuggestionSelected = suggestion => {
    if (!suggestion) {
      this.componentInstance.setValue('', {
        triggerDefaultQuery: true,
        triggerCustomQuery: true,
        stateChanges: true
      });
      return;
    }
    this.setValue({
      value: suggestion.value,
      isOpen: false,
      triggerCustomQuery: true
    });
    this.triggerClickAnalytics(
      suggestion._click_id,
      true,
      suggestion.source && suggestion.source._id
    );
    this.onValueSelected(
      suggestion.value,
      causes.SUGGESTION_SELECT,
      suggestion.source
    );
  };

  handleStateChange = changes => {
    const { isOpen, type } = changes;
    if (type === Downshift.stateChangeTypes.mouseUp) {
      this.setState({
        isOpen
      });
    }
  };

  handleFocus = event => {
    this.setState({
      isOpen: true
    });
    if (this.props.onFocus) {
      this.props.onFocus(this.componentInstance, event);
    }
  };

  renderInputAddonBefore = () => {
    const { addonBefore } = this.props;
    if (addonBefore) {
      return <InputAddon>{addonBefore}</InputAddon>;
    }

    return null;
  };

  renderInputAddonAfter = () => {
    const { addonAfter } = this.props;
    if (addonAfter) {
      return <InputAddon>{addonAfter}</InputAddon>;
    }

    return null;
  };

  renderIcons = () => {
    const {
      iconPosition,
      showClear,
      clearIcon,
      getMicInstance,
      renderMic,
      innerClass,
      showVoiceSearch,
      icon,
      showIcon,
      micStatus
    } = this.props;
    const currentValue = this.componentInstance.value;
    return (
      <Icons
        clearValue={this.clearValue}
        iconPosition={iconPosition}
        showClear={showClear}
        clearIcon={clearIcon}
        currentValue={currentValue}
        handleSearchIconClick={this.handleSearchIconClick}
        icon={icon}
        showIcon={showIcon}
        getMicInstance={getMicInstance}
        renderMic={renderMic}
        innerClass={innerClass}
        enableVoiceSearch={showVoiceSearch}
        onMicClick={() => {
          this.componentInstance && this.componentInstance.onMicClick(null);
        }}
        micStatus={micStatus}
      />
    );
  };

  renderNoSuggestion = () => {
    const {
      renderNoSuggestion,
      innerClass,
      renderError,
      loading,
      error
    } = this.props;
    const { isOpen } = this.state;
    const currentValue = this.componentInstance.value;
    if (
      renderNoSuggestion &&
      isOpen &&
      !this.suggestionsList.length &&
      !loading &&
      currentValue &&
      !(renderError && error)
    ) {
      return (
        <SuggestionWrapper
          className="no-suggestions"
          innerClass={innerClass}
          innerClassName="noSuggestion"
        >
          {typeof renderNoSuggestion === 'function'
            ? renderNoSuggestion(currentValue)
            : renderNoSuggestion}
        </SuggestionWrapper>
      );
    }
    return null;
  };

  renderError = () => {
    const { renderError, innerClass, error, loading } = this.props;
    const currentValue = this.componentInstance.value;
    if (error && renderError && currentValue && !loading) {
      return (
        <SuggestionWrapper innerClass={innerClass} innerClassName="error">
          {isFunction(renderError) ? renderError(error) : renderError}
        </SuggestionWrapper>
      );
    }
    return null;
  };

  renderLoader = () => {
    const { loader, innerClass, loading } = this.props;
    const currentValue = this.componentInstance.value;
    if (loading && loader && currentValue) {
      return (
        <SuggestionWrapper innerClass={innerClass} innerClassName="loader">
          {loader}
        </SuggestionWrapper>
      );
    }
    return null;
  };

  handleKeyDown = (event, highlightedIndex) => {
    // if a suggestion was selected, delegate the handling
    // to suggestion handler
    if (event.key === 'Enter' && highlightedIndex === null) {
      this.setValue({
        value: event.target.value,
        isOpen: false,
        triggerCustomQuery: true
      });
      this.onValueSelected(event.target.value, causes.ENTER_PRESS);
    }
    if (event.key === 'Escape') {
      this.setState({ isOpen: false });
    }

    if (this.props.onKeyDown) {
      this.props.onKeyDown(this.componentInstance, event);
    }
  };

  focusSearchBox = event => {
    const elt = event.target || event.srcElement;
    const tagName = elt.tagName;
    if (
      elt.isContentEditable ||
      tagName === 'INPUT' ||
      tagName === 'SELECT' ||
      tagName === 'TEXTAREA'
    ) {
      // already in an input
      return;
    }
    this.searchInputField.current.focus();
  };

  // used currently for handling manual focus-on-searchbox input instance
  // when single keys like a-z, A-Z are used
  onKeyDown = event => {
    const { focusShortcuts } = this.props;
    if (
      isEmpty(focusShortcuts) ||
      (this.shouldUtilizeHotkeysLib && typeof this.hotkeys == 'function')
    ) {
      return;
    }
    const shortcuts = focusShortcuts.map(key => {
      if (typeof key === 'string') {
        return isNumeric(key)
          ? parseInt(key, 10)
          : key.toUpperCase().charCodeAt(0);
      }
      return key;
    });

    // the below algebraic expression is used to get the correct ascii code out of the e.which || e.keycode returned value
    // since the keyboards doesn't understand ascii but scan codes and they differ for certain keys such as '/'
    // stackoverflow ref: https://stackoverflow.com/a/29811987/10822996
    let which = event.which || event.keyCode;
    let chrCode = which - 48 * Math.floor(which / 48);
    if (shortcuts.indexOf(which >= 96 ? chrCode : which) === -1) {
      // not the right shortcut
      return;
    }
    this.focusSearchBox(event);
    event.stopPropagation();
    event.preventDefault();
  };

  // used for handling focus-on-searchbox input instance
  // when modifier keys or hotkeys combinations are used
  registerHotkeysListener = () => {
    const { focusShortcuts } = this.props;
    if (
      !this.shouldUtilizeHotkeysLib ||
      !(typeof this.hotkeys == 'function') ||
      isEmpty(focusShortcuts)
    ) {
      return;
    }

    // for single press keys (a-z, A-Z) &, hotkeys' combinations such as 'cmd+k', 'ctrl+shft+a', etc
    this.hotkeys(
      parseFocusShortcuts(focusShortcuts).join(','),
      /* eslint-disable no-shadow */
      // eslint-disable-next-line no-unused-vars
      (event, handler) => {
        // Prevent the default refresh event under WINDOWS system
        event.preventDefault();
        this.focusSearchBox(event);
      }
    );

    // if one of modifier keys are used, they are handled below
    this.hotkeys('*', event => {
      const modifierKeys = extractModifierKeysFromFocusShortcuts(
        focusShortcuts
      );

      if (modifierKeys.length === 0) return;

      for (let index = 0; index < modifierKeys.length; index += 1) {
        const element = modifierKeys[index];
        if (this.hotkeys[element]) {
          this.focusSearchBox(event);
          break;
        }
      }
    });
  };

  renderSuggestionsDropdown = ({
    style,
    className,
    title,
    innerClass,
    defaultSuggestions,
    autosuggest,
    showIcon,
    showClear,
    iconPosition,
    placeholder,
    onBlur,
    onKeyPress,
    onKeyUp,
    downShiftProps,
    onFocus,
    onKeyDown,
    autoFocus,
    value,
    size,
    recentSearches,
    recentSearchesIcon,
    popularSearchesIcon,
    getInputProps,
    getItemProps,
    isOpen,
    highlightedIndex,
    getRootProps,
    currentValue,
    ...rest
  }) => {
    return (
      <>
        {' '}
        {this.hasCustomRenderer && (
          <div>
            {this.getComponent({
              downshiftProps: {
                getInputProps,
                getItemProps,
                isOpen,
                highlightedIndex
              },
              ...rest
            })}
            {this.renderLoader()}
          </div>
        )}
        {this.renderError()}
        {!this.hasCustomRenderer && isOpen ? (
          <ul css={suggestionsCss} className={getClassName(innerClass, 'list')}>
            {this.suggestionsList.slice(0, size).map((item, index) => (
              <li
                {...getItemProps({ item })}
                key={`${index + 1}-${item.value}`}
                style={{
                  backgroundColor: this.getBackgroundColor(
                    highlightedIndex,
                    index
                  )
                }}
              >
                <SuggestionItem currentValue={currentValue} suggestion={item} />
              </li>
            ))}
            {!currentValue
              ? (recentSearches || []).map((sugg, index) => (
                  <li
                    {...getItemProps({ item: sugg })}
                    key={`${index + 1}-${sugg.value}`}
                    style={{
                      backgroundColor: this.getBackgroundColor(
                        highlightedIndex,
                        index
                      ),
                      justifyContent: 'flex-start'
                    }}
                  >
                    <div style={{ padding: '0 10px 0 0' }}>
                      <CustomSvg
                        iconId={`${index + 1}-${sugg.value}-icon`}
                        className={
                          getClassName(innerClass, 'recent-search-icon') || null
                        }
                        icon={recentSearchesIcon}
                        type="recent-search-icon"
                      />
                    </div>
                    <SuggestionItem
                      currentValue={currentValue}
                      suggestion={sugg}
                    />
                  </li>
                ))
              : null}
            {hasPopularSuggestionsRenderer(this.props)
              ? this.getComponent(
                  {
                    getInputProps,
                    getItemProps,
                    isOpen,
                    highlightedIndex,
                    ...rest
                  },
                  true
                )
              : (this.popularSuggestionsList || []).map((sugg, index) => (
                  <li
                    {...getItemProps({ item: sugg })}
                    key={`${index +
                      (!currentValue ? recentSearches.length : 0) +
                      this.suggestionsList.length +
                      1}-${sugg.value}`}
                    style={{
                      backgroundColor: this.getBackgroundColor(
                        highlightedIndex,
                        index +
                          this.suggestionsList.length +
                          (!currentValue ? recentSearches.length : 0)
                      ),
                      justifyContent: 'flex-start'
                    }}
                  >
                    <div style={{ padding: '0 10px 0 0' }}>
                      <CustomSvg
                        iconId={`${index + 1}-${sugg.value}-icon`}
                        className={
                          getClassName(innerClass, 'popular-search-icon') ||
                          null
                        }
                        icon={popularSearchesIcon}
                        type="popular-search-icon"
                      />
                    </div>
                    <SuggestionItem
                      currentValue={currentValue}
                      suggestion={sugg}
                    />
                  </li>
                ))}
          </ul>
        ) : (
          this.renderNoSuggestion()
        )}
      </>
    );
  };

  render() {
    const {
      style,
      className,
      title,
      innerClass,
      defaultSuggestions,
      autosuggest,
      showIcon,
      showClear,
      showVoiceSearch,
      iconPosition,
      placeholder,
      onBlur,
      onKeyPress,
      onKeyUp,
      downShiftProps,
      onFocus,
      onKeyDown,
      autoFocus,
      value,
      recentSearches
    } = this.props;
    const currentValue = this.componentInstance.value || '';
    const hasSuggestions = defaultSuggestions || recentSearches;
    return (
      <div style={style} className={className}>
        {title && (
          <Title className={getClassName(innerClass, 'title') || null}>
            {title}
          </Title>
        )}
        {hasSuggestions || autosuggest ? (
          <Downshift
            onChange={this.onSuggestionSelected}
            onStateChange={this.handleStateChange}
            isOpen={this.state.isOpen}
            itemToString={i => i}
            {...downShiftProps}
          >
            {({
              getInputProps,
              getItemProps,
              isOpen,
              highlightedIndex,
              getRootProps,
              ...rest
            }) => (
              <div {...getRootProps({ css: suggestionsContainer })}>
                <InputGroup>
                  {this.renderInputAddonBefore()}
                  <InputWrapper>
                    <Input
                      ref={this.searchInputField}
                      showIcon={showIcon}
                      showClear={showClear}
                      showVoiceSearch={showVoiceSearch}
                      iconPosition={iconPosition}
                      {...getInputProps({
                        className: getClassName(innerClass, 'input'),
                        placeholder: placeholder,
                        value:
                          value || (currentValue === null ? '' : currentValue),
                        onChange: this.onInputChange,
                        onBlur: this.withTriggerQuery(onBlur),
                        onFocus: this.handleFocus,
                        onKeyPress: this.withTriggerQuery(onKeyPress),
                        onKeyUp: this.withTriggerQuery(onKeyUp),
                        onKeyDown: e => this.handleKeyDown(e, highlightedIndex),
                        autoFocus: autoFocus
                      })}
                    />{' '}
                    {this.renderIcons()}
                    {!this.props.expandSuggestionsContainer &&
                      this.renderSuggestionsDropdown({
                        ...this.props,
                        getInputProps,
                        getItemProps,
                        isOpen,
                        highlightedIndex,
                        getRootProps,
                        currentValue,
                        ...rest
                      })}
                  </InputWrapper>
                  {this.renderInputAddonAfter()}
                </InputGroup>

                {this.props.expandSuggestionsContainer &&
                  this.renderSuggestionsDropdown({
                    ...this.props,
                    getInputProps,
                    getItemProps,
                    isOpen,
                    highlightedIndex,
                    getRootProps,
                    currentValue,
                    ...rest
                  })}
              </div>
            )}
          </Downshift>
        ) : (
          <div css={suggestionsContainer}>
            <InputGroup>
              {this.renderInputAddonBefore()}
              <InputWrapper>
                <Input
                  ref={this.searchInputField}
                  className={getClassName(innerClass, 'input') || null}
                  placeholder={placeholder}
                  value={value || (currentValue === null ? '' : currentValue)}
                  onChange={this.onInputChange}
                  onBlur={this.withTriggerQuery(onBlur)}
                  onFocus={this.withTriggerQuery(onFocus)}
                  onKeyPress={this.withTriggerQuery(onKeyPress)}
                  onKeyDown={this.withTriggerQuery(onKeyDown)}
                  onKeyUp={this.withTriggerQuery(onKeyUp)}
                  autoFocus={autoFocus}
                  iconPosition={iconPosition}
                  showIcon={showIcon}
                  showClear={showClear}
                  showVoiceSearch={showVoiceSearch}
                />
                {this.renderIcons()}
              </InputWrapper>
              {this.renderInputAddonAfter()}
            </InputGroup>
          </div>
        )}
      </div>
    );
  }
}

SearchBox.propTypes = {
  enablePopularSuggestions: bool,
  maxPopularSuggestions: number,
  maxRecentSearches: number,
  enablePredictiveSuggestions: bool,
  dataField: dataFieldValidator,
  aggregationField: string,
  aggregationSize: number,
  nestedField: string,
  size: number,
  title: string,
  defaultValue: string,
  value: string,
  downShiftProps: object,
  placeholder: string,
  showIcon: bool,
  iconPosition: position,
  icon: any,
  showClear: bool,
  clearIcon: any,
  autosuggest: bool,
  strictSelection: bool,
  defaultSuggestions: suggestionsDef,
  debounce: wholeNumber,
  highlight: bool,
  highlightField,
  customHighlight: func,
  queryFormat,
  fuzziness: fuzzinessDef,
  showVoiceSearch: bool,
  searchOperators: bool,
  render: func,
  renderPopularSuggestions: func,
  renderError: func,
  renderNoSuggestion: titleDef,
  getMicInstance: func,
  renderMic: func,
  onChange: func,
  onValueChange: func,
  onValueSelected: func,
  onAggregationData: func,
  onError: func,
  onResults: func,
  innerClass: object,
  style: object,
  defaultQuery: func,
  beforeValueChange: func,
  onQueryChange: func,
  className: string,
  loader: object,
  onBlur: func,
  onKeyPress: func,
  onKeyUp: func,
  onFocus: func,
  onKeyDown: func,
  autoFocus: bool,
  URLParams: bool,
  clearOnQueryChange: bool,
  appbaseConfig: appbaseConfigDef,
  showDistinctSuggestions: bool,
  queryString: bool,
  recentSearchesIcon: element,
  popularSearchesIcon: element,
  focusShortcuts: array,
  addonBefore: any,
  addonAfter: any,
  expandSuggestionsContainer: bool,
  distinctField: string,
  distinctFieldConfig: object,
  index: string,
  // internal props
  error: any,
  loading: bool,
  results: object
};

SearchBox.defaultProps = {
  enableRecentSearches: false,
  placeholder: 'Search',
  showIcon: true,
  iconPosition: 'right',
  showClear: false,
  autosuggest: true,
  strictSelection: false,
  debounce: 0,
  showVoiceSearch: false,
  className: '',
  autoFocus: false,
  downShiftProps: {},
  URLParams: false,
  showDistinctSuggestions: true,
  enablePopularSuggestions: false,
  enablePredictiveSuggestions: false,
  clearOnQueryChange: true,
  recentSearches: [],
  recentSearchesIcon: undefined,
  popularSearchesIcon: undefined,
  focusShortcuts: ['/'],
  addonBefore: undefined,
  addonAfter: undefined,
  expandSuggestionsContainer: true,
  index: undefined,
  value: undefined
};

export default props => (
  <SearchComponent
    triggerQueryOnInit={!!props.enablePopularSuggestions}
    value="" // Init value as empty
    clearOnQueryChange
    {...props}
    subscribeTo={[
      'micStatus',
      'error',
      'requestPending',
      'results',
      'value',
      'recentSearches'
    ]}
  >
    {({ error, loading, results, value, recentSearches, micStatus }) => (
      <SearchBox
        {...props}
        error={error}
        loading={loading}
        results={results}
        recentSearches={recentSearches}
        micStatus={micStatus}
      />
    )}
  </SearchComponent>
);
