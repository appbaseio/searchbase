import React from 'react';
import {
  any,
  bool,
  func,
  number,
  object,
  string,
  arrayOf,
  array,
  oneOfType
} from 'prop-types';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity
} from 'react-native';
import {
  appbaseConfig as appbaseConfigDef,
  fuzziness as fuzzinessDef,
  queryFormat,
  title as titleDef,
  wholeNumber,
  dataField as dataFieldDef
} from '../../utils/types';
import Icon from './SearchBar/Icon';
import { renderNode, nodeType } from './SearchBar/helpers';
import defaultTheme from './SearchBar/helpers/theme';
import SearchComponent from '../SearchComponent';

import {
  debounce as debounceFunc,
  equals,
  getComponent,
  hasCustomRenderer,
  SearchContext,
  isFunction
} from '../../utils/helper';
import SearchBar from './SearchBar';
import causes from '../../utils/causes';

// TODO: Change for android
const defaultGoBackIcon = theme => ({
  type: 'ionicon',
  size: 24,
  name: 'ios-arrow-back'
});

const defaultRecentSearchIcon = theme => ({
  type: 'material',
  size: 24,
  name: 'history'
});

const defaultPopularSuggestionIcon = theme => ({
  type: 'material',
  size: 24,
  name: 'trending-up',
  style: {marginRight: 10}
});

const defaultAutoFillIcon = theme => ({
  type: 'feather',
  size: 24,
  name: 'arrow-up-left'
});

class SearchBox extends React.Component {
  static contextType = SearchContext;

  constructor(props, context) {
    super(props, context);
    const { value, defaultValue } = props;
    let currentValue = value || defaultValue || '';

    this.state = {
      showModal: false,
      autoFillInProgress: false
    };
    // Set the value in searchbase instance
    if (currentValue) {
      this.componentInstance.setValue(currentValue, {
        triggerDefaultQuery: false,
        triggerCustomQuery: true,
        stateChanges: true
      });
    }
    if (this.componentInstance) {
      const onResults = () => {
        this.scrollToTop();
      };
      if (this.componentInstance.onResults) {
        this.componentInstance.onResults = () => {
          onResults();
          this.componentInstance.onResults();
        };
      } else {
        this.componentInstance.onResults = onResults;
      }
    }
    this.searchbarRef = React.createRef();
    this.flatListRef = React.createRef();
  }

  componentDidMount() {
    const { aggregationField } = this.props;
    if (aggregationField) {
      console.warn(
          'Warning(SearchBox): The `aggregationField` prop has been marked as deprecated, please use the `distinctField` prop instead.',
      );
    }
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

  closeModal = () => {
    const { showModal, autoFillInProgress } = this.state;
    if (showModal) {
      this.clearState(() => {
        if (autoFillInProgress) {
          // Clear stale query
          this.setValue({
            value: ''
          });
        }
      });
    }
  };

  openModal = () => {
    const { enableRecentSearches } = this.props;
    const { showModal } = this.state;
    if (!showModal) {
      this.setState(
        {
          showModal: true
        },
        this.setFocus
      );
      // Refresh recent searches
      if (enableRecentSearches) {
        // Only fetch if value is empty
        if (!this.componentInstance.value) {
          // Empty suggestions
          this.componentInstance.clearResults();
          this.componentInstance.getRecentSearches();
        }
      }
    }
  };

  get componentInstance() {
    const { id } = this.props;
    return this.context.getComponent(id);
  }

  get popularSuggestionsList() {
    const suggestions = this.componentInstance.suggestions;
    return (suggestions || []).filter(
      suggestion => suggestion.source && suggestion.source._popular_suggestion
    );
  }

  get suggestionsList() {
    const { defaultSuggestions } = this.props;
    if (!this.componentInstance.value && defaultSuggestions) {
      return defaultSuggestions;
    }
    const suggestions = this.componentInstance.suggestions;
    return (suggestions || []).filter(
      suggestion =>
        !(suggestion.source && suggestion.source._popular_suggestion)
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

  get totalSuggestions() {
    return [...this.suggestionsList, ...this.popularSuggestionsList];
  }

  _applySetter = (prev, next, setterFunc) => {
    if (!equals(prev, next))
      this.componentInstance && this.componentInstance[setterFunc](next);
  };

  getComponent = (isPopularSuggestionsRender = false) => {
    const { error, loading, recentSearches } = this.props;
    const data = {
      error,
      loading,
      data: this.suggestionsList,
      value: this.componentInstance.value,
      triggerClickAnalytics: this.triggerClickAnalytics,
      promotedData: this.componentInstance.results.promotedData,
      customData: this.componentInstance.results.customData,
      resultStats: this.stats,
      rawData: this.componentInstance.results.rawData,
      popularSuggestions: this.popularSuggestionsList,
      recentSearches
    };
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

  onInputChange = value => {
    this.setValue({ value });
  };

  scrollToTop = () => {
    this.flatListRef.current &&
      this.flatListRef.current.scrollToOffset({ animated: true, offset: 0 });
  };

  setValue = ({ value, clearResults = true, ...rest }) => {
    let triggerDefaultQuery = true;
    const { autoFillInProgress } = this.state;
    const { onChange, debounce, autosuggest } = this.props;
    if (!autosuggest) {
      triggerDefaultQuery = false;
    } else if (rest.triggerDefaultQuery !== undefined) {
      triggerDefaultQuery = rest.triggerDefaultQuery;
    }
    if (autoFillInProgress) {
      this.setState({
        autoFillInProgress: false
      });
    }
    if (onChange) {
      onChange(value, this.triggerCustomQuery);
    } else {
      if (!value && clearResults) {
        // Clear suggestions for empty value
        this.componentInstance.clearResults();
      }
      if (debounce > 0) {
        this.componentInstance.setValue(value, {
          triggerDefaultQuery: false,
          triggerCustomQuery: false,
          stateChanges: true
        });
        // only fetch suggestions for value
        if (value && triggerDefaultQuery) {
          debounceFunc(this.triggerDefaultQuery, debounce);
        }
        if (!autosuggest) {
          debounceFunc(this.triggerCustomQuery, debounce);
        }
        if (rest.triggerCustomQuery) {
          this.triggerCustomQuery();
        }
      } else {
        this.componentInstance.setValue(value || '', {
          triggerCustomQuery: rest.triggerCustomQuery,
          // only fetch suggestions for value
          triggerDefaultQuery: !!value && triggerDefaultQuery,
          stateChanges: true
        });
        if (!autosuggest) {
          this.triggerCustomQuery();
        }
      }
    }
  };

  onValueSelected = (currentValue = this.componentInstance.value, ...cause) => {
    const { onValueSelected } = this.props;
    if (onValueSelected) {
      onValueSelected(currentValue, ...cause);
    }
  };

  clearValue = () => {
    this.setValue({ value: '', triggerCustomQuery: true });
    this.onValueSelected(null, causes.CLEAR_VALUE);
  };

  onSuggestionSelected = suggestion => {
    this.setValue({
      value: suggestion && suggestion.value,
      triggerCustomQuery: true
    });
    // Keyboard.dissmiss();
    this.closeModal();
    this.triggerClickAnalytics(
      suggestion && suggestion._click_id,
      true,
      suggestion.source && suggestion.source._id
    );
    this.onValueSelected(
      suggestion.value,
      causes.SUGGESTION_SELECT,
      suggestion.source
    );
  };

  renderNoSuggestion = () => {
    const { renderNoSuggestion, loading, error } = this.props;
    const currentValue = this.componentInstance.value;
    if (
      renderNoSuggestion &&
      !this.totalSuggestions.length &&
      !loading &&
      currentValue &&
      !error
    ) {
      return typeof renderNoSuggestion === 'function'
        ? renderNoSuggestion(currentValue)
        : renderNoSuggestion;
    }
    return null;
  };

  clearState = (cb = () => null) => {
    this.setState(
      {
        showModal: false,
        autoFillInProgress: false
      },
      cb
    );
  };

  handleSubmitEditing = e => {
    const text = e.nativeEvent.text;
    // if a suggestion was selected, delegate the handling
    // to suggestion handler
    this.clearState(() =>
      this.setValue({
        value: text,
        triggerCustomQuery: true
      })
    );
    this.onValueSelected(text, causes.ENTER_PRESS);
  };

  setFocus() {
    setTimeout(() => {
      if (this.searchbarRef.current) {
        this.searchbarRef.current.focus();
      }
    }, 40);
  }

  handleAutoFill = (item, recentSearch) => {
    this.setState(
      {
        autoFillInProgress: true
      },
      () => {
        this.componentInstance.setValue(item.value);
      }
    );
  };

  renderSearchInput({ isOpenWithModal = false, ...rest } = {}) {
    const { placeholder, theme, loading, style, searchBarProps } = this.props;
    const currentValue = this.componentInstance.value || '';
    return (
      <SearchBar
        onChangeText={this.onInputChange}
        onSubmitEditing={this.handleSubmitEditing}
        onClear={this.clearValue}
        placeholder={placeholder}
        value={currentValue}
        autoFocus={isOpenWithModal}
        theme={theme}
        showLoading={loading}
        returnKeyType="search"
        ref={this.searchbarRef}
        style={style}
        {...rest}
        {...searchBarProps}
      />
    );
  }

  renderAutoSuggestView() {
    const {
      theme,
      goBackIcon = defaultGoBackIcon(theme),
      size,
      searchHeaderStyle,
      recentSearches,
      suggestionsContainerStyle
    } = this.props;
    return (
      <Modal
        supportedOrientations={null}
        transparent={false}
        visible={this.state.showModal}
        onRequestClose={this.closeModal}
      >
        <SafeAreaView style={styles.flex1}>
          <View style={styles.flex1}>
            <View
              style={StyleSheet.flatten([
                styles.searchHeaderStyle(theme),
                searchHeaderStyle
              ])}
            >
              {renderNode(Icon, goBackIcon, {
                theme,
                ...defaultGoBackIcon(theme),
                onPress: this.closeModal
              })}
            </View>
            {this.renderSearchInput({
              isOpenWithModal: true
            })}
            {this.hasCustomRenderer ? (
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={StyleSheet.flatten([
                  styles.flex1,
                  suggestionsContainerStyle
                ])}
              >
                {this.getComponent()}
              </KeyboardAvoidingView>
            ) : (
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={StyleSheet.flatten([
                  styles.flex1,
                  suggestionsContainerStyle
                ])}
              >
                {this.renderError()}
                {this.renderNoSuggestion()}
                {this.totalSuggestions.length ? (
                  <FlatList
                    ref={this.flatListRef}
                    data={this.totalSuggestions.slice(0, size)}
                    keyboardShouldPersistTaps={'handled'}
                    keyExtractor={item => item.label}
                    ItemSeparatorComponent={this.renderItemSeparator}
                    renderItem={this.renderSuggestionItem}
                  />
                ) : null}
                {!this.componentInstance.value &&
                  recentSearches &&
                  recentSearches.length && (
                    <FlatList
                      data={(recentSearches || []).slice(0, size)}
                      keyboardShouldPersistTaps={'handled'}
                      keyExtractor={item => item.label}
                      ItemSeparatorComponent={this.renderItemSeparator}
                      renderItem={rest =>
                        this.renderSuggestionItem({
                          isRecentSearch: true,
                          ...rest
                        })
                      }
                    />
                  )}
              </KeyboardAvoidingView>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  renderSuggestionItem = ({ item, isRecentSearch }) => {
    const {
      renderItem,
      theme,
      autoFillIcon = defaultAutoFillIcon(theme),
      showAutoFill,
      recentSearchIcon = defaultRecentSearchIcon(theme),
      popularSuggestionIcon = defaultPopularSuggestionIcon(theme)
    } = this.props;
    const { isPredictiveSuggestion } = item;
    let normalText = '';
    let highlightedText = '';
    if (isPredictiveSuggestion) {
      normalText = (/[^<]*/).exec(item.label)[0];
      highlightedText = (/>[^<]*/).exec(item.label)[0].replaceAll('>', '');
    }
    if (renderItem) {
      return renderItem(item, isRecentSearch);
    }
    return (
      <View style={styles.itemStyle}>
        {isRecentSearch
          ? renderNode(Icon, recentSearchIcon, {
              theme,
              onPress: () => this.onSuggestionSelected(item),
              ...defaultRecentSearchIcon(theme)
            })
          : null}
        {item.source && item.source._popular_suggestion
          ? renderNode(Icon, popularSuggestionIcon, {
              theme,
              onPress: () => this.onSuggestionSelected(item),
              ...defaultPopularSuggestionIcon(theme)
            })
          : null}
        {isPredictiveSuggestion ? (
          <TouchableOpacity style={{display: 'flex', flexDirection: 'row', flex: 1}} onPress={() => this.onSuggestionSelected(item)}>
            <Text>{normalText}</Text>
            <Text style={{ fontWeight: '700' }} numberOfLines={1}>{highlightedText}</Text>
          </TouchableOpacity>
        ) : (
          <Text
            style={styles.itemText}
            onPress={() => this.onSuggestionSelected(item)}
            numberOfLines={1}
          >
            {item.label}
          </Text>
        )}
        <View styles={styles.autoFillIcon}>
          {showAutoFill
            ? renderNode(Icon, autoFillIcon, {
                theme,
                onPress: () => this.handleAutoFill(item, isRecentSearch),
                ...defaultAutoFillIcon(theme)
              })
            : null}
        </View>
      </View>
    );
  };

  renderItemSeparator = () => {
    const { separatorStyle, theme } = this.props;
    return (
      // Flat List Item Separator
      <View
        style={StyleSheet.flatten([
          styles.itemSeparator(theme),
          separatorStyle
        ])}
      />
    );
  };

  renderError = () => {
    const { renderError, error, loading } = this.props;
    if (error && renderError && !loading) {
      return isFunction(renderError) ? renderError(error) : renderError;
    }
    return null;
  };

  render() {
    const { showModal } = this.state;
    const { autosuggest } = this.props;
    if (!autosuggest) {
      return this.renderSearchInput();
    }
    return showModal
      ? this.renderAutoSuggestView()
      : autosuggest && (
          <Pressable onPress={this.openModal}>
            {this.renderSearchInput({
              pointerEvents: 'none'
            })}
          </Pressable>
        );
  }
}

SearchBox.propTypes = {
  // RS API
  dataField: dataFieldDef,
  aggregationField: string,
  aggregationSize: number,
  nestedField: string,
  size: number,
  debounce: wholeNumber,
  // TODO: Implement later
  // highlight: bool,
  // highlightField,
  // customHighlight: func,
  queryFormat,
  fuzziness: fuzzinessDef,
  searchOperators: bool,
  onValueSelected: func,
  onAggregationData: func,
  onError: func,
  onResults: func,
  defaultQuery: func,
  customQuery: func,
  onQueryChange: func,
  appbaseConfig: appbaseConfigDef,
  showDistinctSuggestions: bool,
  queryString: bool,
  // Customize Suggestions
  defaultSuggestions: arrayOf(object),
  autosuggest: bool,
  showAutoFill: bool,
  enablePopularSuggestions: bool,
  enableRecentSearches: bool,
  maxPopularSuggestions: number,
  distinctField: string,
  distinctFieldConfig: object,
  // icons
  autoFillIcon: nodeType,
  recentSearchIcon: nodeType,
  goBackIcon: nodeType,
  // Customize UI
  defaultValue: string,
  value: string,
  placeholder: string,
  render: func,
  renderItem: func,
  renderNoSuggestion: titleDef,
  renderError: titleDef,
  style: object,
  searchBarProps: object,
  separatorStyle: oneOfType([object, array]),
  searchHeaderStyle: oneOfType([object, array]),
  suggestionsContainerStyle: oneOfType([object, array]),
  // Voice Search
  // TODO: Implement voice search
  // showVoiceSearch: bool,
  // getMicInstance: func,
  // renderMic: func,
  // internal props
  error: any,
  loading: bool,
  results: object,
  recentSearches: array,
  enablePredictiveSuggestions: bool
};

SearchBox.defaultProps = {
  maxPopularSuggestions: 5,
  enablePopularSuggestions: false,
  enableRecentSearches: false,
  showAutoFill: true,
  theme: defaultTheme,
  placeholder: 'Search',
  showIcon: true,
  autosuggest: true,
  debounce: 0,
  showVoiceSearch: false,
  className: '',
  autoFocus: false,
  downShiftProps: {},
  showDistinctSuggestions: true,
  enablePredictiveSuggestions: false
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  itemStyle: {
    flex: 1,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center'
  },
  itemText: {
    flex: 1,
    padding: 10
  },
  autoFillIcon: {
    justifyContent: 'flex-end'
  },
  itemSeparator: theme => ({
    height: 0.5,
    width: '100%',
    backgroundColor: '#C8C8C8'
  }),
  searchHeaderStyle: theme => ({
    height: 45,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 10
  }),
  flex1: {
    flex: 1
  }
});

export default props => (
  <SearchComponent
    triggerQueryOnInit={false}
    value="" // Init value as empty
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
    {({ error, loading, results, value, recentSearches }) => {
      return (
        <SearchBox
          {...props}
          error={error}
          loading={loading}
          results={results}
          recentSearches={recentSearches}
        />
      );
    }}
  </SearchComponent>
);
