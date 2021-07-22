import VueTypes from 'vue-types';
import SearchComponent from './SearchComponent.jsx';
import { types } from '../utils/types';
import InputGroup from '../styles/InputGroup';
import InputWrapper from '../styles/InputWrapper';
import InputAddon from '../styles/InputAddon';
import Input from '../styles/Input';
import DownShift from './DownShift.jsx';
import {
	equals,
	getClassName,
	debounce as debounceFunc,
	hasPopularSuggestionsRenderer,
	getPopularSuggestionsComponent,
	hasCustomRenderer,
	getComponent,
	isEmpty,
	isHotkeyCombinationUsed,
	parseFocusShortcuts,
	isNumeric,
	isModifierKeyUsed,
	extractModifierKeysFromFocusShortcuts
} from '../utils/helper';
import {
	suggestions as suggestionsStyle,
	suggestionsContainer
} from '../styles/Suggestions';
import SuggestionItem from '../addons/SuggestionItem.jsx';
import Title from '../styles/Title';
import Icons from './Icons.jsx';
import causes from '../utils/causes';
import CustomSvg from '../styles/CustomSvg';

const SearchBox = {
	name: 'search-box',
	inject: ['searchbase'],
	props: {
		// common props for search component and search box
		index: VueTypes.string,
		// search component props
		url: VueTypes.string,
		credentials: VueTypes.string,
		headers: VueTypes.object,
		appbaseConfig: types.appbaseConfig,
		transformRequest: VueTypes.func,
		transformResponse: VueTypes.func,
		beforeValueChange: VueTypes.func,
		enablePopularSuggestions: VueTypes.bool,
		maxPopularSuggestions: VueTypes.number,
		maxRecentSearches: VueTypes.number,
		enablePredictiveSuggestions: VueTypes.bool,
		enableRecentSearches: VueTypes.bool,
		clearOnQueryChange: VueTypes.bool,
		showDistinctSuggestions: types.showDistinctSuggestions,
		URLParams: VueTypes.bool,
		// RS API properties
		id: VueTypes.string.isRequired,
		value: VueTypes.string.def('undefined'),
		type: types.queryTypes,
		react: types.reactType,
		queryFormat: types.queryFormat,
		dataField: types.dataField,
		categoryField: VueTypes.string,
		categoryValue: VueTypes.string,
		nestedField: VueTypes.string,
		from: VueTypes.number,
		size: VueTypes.number,
		sortBy: types.sortType,
		aggregationField: VueTypes.string,
		aggregationSize: VueTypes.number,
		after: VueTypes.object,
		includeNullValues: VueTypes.bool,
		includeFields: types.sourceFields,
		excludeFields: types.sourceFields,
		fuzziness: types.fuzziness,
		searchOperators: VueTypes.bool,
		highlight: VueTypes.bool,
		highlightField: VueTypes.string,
		customHighlight: VueTypes.object,
		interval: VueTypes.number,
		aggregations: VueTypes.arrayOf(VueTypes.string),
		missingLabel: VueTypes.string,
		showMissing: VueTypes.bool,
		defaultQuery: VueTypes.func,
		customQuery: VueTypes.func,
		enableSynonyms: VueTypes.bool,
		selectAllLabel: VueTypes.string,
		pagination: VueTypes.bool,
		queryString: VueTypes.bool,
		distinctField: VueTypes.string,
		distinctFieldConfig: VueTypes.object,
		// subscribe on changes,
		subscribeTo: VueTypes.arrayOf(VueTypes.string),
		triggerQueryOnInit: VueTypes.bool.def(true),
		// searchbox specific
		title: types.title,
		defaultValue: types.defaultValue,
		placeholder: types.placeholder,
		showIcon: types.showIcon,
		iconPosition: types.iconPosition,
		icon: types.icon,
		showClear: types.showClear,
		clearIcon: types.clearIcon,
		autosuggest: types.autosuggest,
		strictSelection: types.strictSelection,
		defaultSuggestions: types.defaultSuggestions,
		recentSearches: types.defaultSuggestions,
		debounce: types.debounce,
		showVoiceSearch: types.showVoiceSearch,
		render: types.render,
		renderError: types.renderError,
		renderNoSuggestion: types.renderNoSuggestion,
		renderPopularSuggestions: types.renderPopularSuggestions,
		renderMic: types.renderMic,
		innerClass: types.innerClass,
		className: types.className,
		loader: types.loader,
		autoFocus: types.autoFocus,
		// Internal props from search component
		loading: VueTypes.bool,
		error: VueTypes.any,
		micStatus: VueTypes.string,
		instanceValue: VueTypes.string,
		//
		focusShortcuts: VueTypes.focusShortcuts,
		addonBefore: VueTypes.any,
		addonAfter: VueTypes.any,
		expandSuggestionsContainer: types.expandSuggestionsContainer
	},
	data() {
		this.state = {
			isOpen: false
		};
		return {
			...this.state,
			hotkeys: undefined,
			shouldUtilizeHotkeysLib: false
		};
	},
	beforeMount() {
		const { focusShortcuts } = this.$props;
		// dynamically import hotkey-js
		if (!isEmpty(focusShortcuts)) {
			this.shouldUtilizeHotkeysLib
        = isHotkeyCombinationUsed(focusShortcuts)
        || isModifierKeyUsed(focusShortcuts);
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
	},
	mounted() {
		document.addEventListener('keydown', this.onKeyDown);
		this.registerHotkeysListener();
		if (this.aggregationField) {
			console.warn(
				'Warning(SearchBox): The `aggregationField` prop has been marked as deprecated, please use the `distinctField` prop instead.'
			);
		}
		if (this.enableRecentSearches && this.autosuggest) {
			const { getRecentSearches } = this.getComponentInstance();
			getRecentSearches({
				size: this.maxRecentSearches || 5,
				minChars: 3
			});
		}
	},
	destroyed() {
		document.removeEventListener('keydown', this.onKeyDown);
	},
	computed: {
		hasCustomRenderer() {
			return hasCustomRenderer(this);
		},
		stats() {
			const { results } = this.$props;
			const total = results.numberOfResults;
			const { time, hidden, promotedData } = results;
			const size = this.$props.size || 10;
			return {
				numberOfResults: total,
				...(size > 0 ? { numberOfPages: Math.ceil(total / size) } : null),
				time,
				hidden,
				promoted: promotedData && promotedData.length
			};
		}
	},
	methods: {
		getComponentInstance() {
			const { id } = this.$props;
			return this.searchbase.getComponent(id);
		},
		getPopularSuggestionsList() {
			const { suggestions } = this.getComponentInstance();
			return (suggestions || []).filter(
				suggestion => suggestion.source._popular_suggestion
			);
		},
		getSuggestionsList() {
			const { defaultSuggestions, instanceValue } = this.$props;
			if (!instanceValue && defaultSuggestions) {
				return defaultSuggestions;
			}
			if (!instanceValue) {
				return [];
			}
			const { suggestions } = this.getComponentInstance();
			return (suggestions || []).filter(
				suggestion => !suggestion.source._popular_suggestion
			);
		},
		_applySetter(prev, next, setterFunc) {
			if (!equals(prev, next)) {
				const component = this.getComponentInstance();
				component[setterFunc](next);
			}
		},
		triggerClickAnalytics(clickPosition, isSuggestion = true, value) {
			const component = this.getComponentInstance();
			if (!component) return;
			if (
				component
        && component.appbaseSettings
        && component.appbaseSettings.recordAnalytics
			) {
				component.recordClick({ [value]: clickPosition }, isSuggestion);
			}
		},
		onValueSelectedHandler(currentValue = this.$props.instanceValue, ...cause) {
			this.$emit('valueSelected', currentValue, ...cause);
		},
		onInputChange(event) {
			this.setValue({ value: event.target.value, event });
		},
		onSuggestionSelected(suggestion) {
			this.setValue({
				value: suggestion && suggestion.value,
				isOpen: false,
				triggerCustomQuery: true
			});
			this.triggerClickAnalytics(
				suggestion && suggestion._click_id,
				true,
				suggestion.source && suggestion.source._id
			);
			this.onValueSelectedHandler(
				suggestion.value,
				causes.SUGGESTION_SELECT,
				suggestion.source
			);
		},
		triggerDefaultQuery() {
			const componentInstance = this.getComponentInstance();
			if (componentInstance) {
				componentInstance.triggerDefaultQuery();
			}
		},
		triggerCustomQuery() {
			const componentInstance = this.getComponentInstance();
			if (componentInstance) {
				componentInstance.triggerCustomQuery();
			}
		},
		isControlled() {
			if (this.$props.value !== undefined && this.$listeners.change) {
				return true;
			}
			return false;
		},
		setValue({ value, isOpen = true, ...rest }) {
			const { debounce } = this.$props;
			this.isOpen = isOpen;
			const componentInstance = this.getComponentInstance();
			if (
				this.enableRecentSearches
        && !value
        && componentInstance.value
        && this.autosuggest
			) {
				componentInstance.getRecentSearches({
					size: this.maxRecentSearches || 5,
					minChars: 3
				});
			}
			if (this.isControlled()) {
				componentInstance.setValue(value, {
					triggerDefaultQuery: false,
					triggerCustomQuery: false
				});
				this.$emit('change', value, componentInstance, rest.event);
			} else if (debounce > 0) {
				componentInstance.setValue(value, {
					triggerDefaultQuery: false,
					triggerCustomQuery: false,
					stateChanges: true
				});
				if (this.autosuggest) {
					// Clear results for empty query
					if (value) {
						debounceFunc(this.triggerDefaultQuery, debounce);
					} else {
						componentInstance.clearResults();
					}
					debounceFunc(this.triggerDefaultQuery, debounce);
				} else {
					debounceFunc(this.triggerCustomQuery, debounce);
				}
				if (rest.triggerCustomQuery) {
					debounceFunc(this.triggerCustomQuery, debounce);
				}
			} else {
				this.triggerSuggestionsQuery(value, rest?.triggerCustomQuery);
				if (!this.autosuggest) {
					this.triggerCustomQuery();
				}
			}
		},
		triggerSuggestionsQuery(value, triggerCustomQuery) {
			const componentInstance = this.getComponentInstance();
			if (componentInstance) {
				if (value) {
					componentInstance.setValue(value, {
						triggerCustomQuery,
						triggerDefaultQuery: true,
						stateChanges: true
					});
				} else {
					componentInstance.setValue(value, {
						triggerCustomQuery,
						triggerDefaultQuery: false,
						stateChanges: true
					});
				}
			}
		},
		handleFocus(event) {
			this.isOpen = true;
			this.withTriggerQuery('focus', event);
		},
		handleStateChange(changes) {
			const { isOpen } = changes;
			this.isOpen = isOpen;
		},
		handleKeyDown(event, highlightedIndex) {
			// if a suggestion was selected, delegate the handling
			// to suggestion handler
			if (event.key === 'Enter' && highlightedIndex === null) {
				this.setValue({
					value: event.target.value,
					isOpen: false,
					triggerCustomQuery: true
				});
				this.onValueSelectedHandler(event.target.value, causes.ENTER_PRESS);
			}
			this.withTriggerQuery('keyDown', event);
		},
		handleMicClick() {
			const componentInstance = this.getComponentInstance();
			componentInstance.onMicClick(null);
		},
		renderInputAddonBefore() {
			const { addonBefore } = this.$scopedSlots;
			if (addonBefore) {
				return <InputAddon>{addonBefore()}</InputAddon>;
			}

			return null;
		},
		renderInputAddonAfter() {
			const { addonAfter } = this.$scopedSlots;
			if (addonAfter) {
				return <InputAddon>{addonAfter()}</InputAddon>;
			}

			return null;
		},
		renderIcons() {
			const {
				iconPosition,
				showClear,
				clearIcon,
				innerClass,
				showVoiceSearch,
				icon,
				showIcon
			} = this.$props;
			const { instanceValue, micStatus } = this.$props;
			return (
				<Icons
					clearValue={this.clearValue}
					iconPosition={iconPosition}
					showClear={showClear}
					clearIcon={clearIcon}
					currentValue={instanceValue}
					handleSearchIconClick={this.handleSearchIconClick}
					icon={icon}
					showIcon={showIcon}
					innerClass={innerClass}
					enableVoiceSearch={showVoiceSearch}
					micStatus={micStatus}
					handleMicClick={this.handleMicClick}
				/>
			);
		},
		renderNoSuggestionComponent() {
			const {
				innerClass,
				renderError,
				loading,
				error,
				instanceValue
			} = this.$props;
			const { isOpen } = this.$data;
			const suggestionsList = this.getSuggestionsList();
			const renderNoSuggestion
        = this.$scopedSlots.renderNoSuggestion || this.$props.renderNoSuggestion;
			if (
				renderNoSuggestion
        && isOpen
        && !suggestionsList.length
        && !loading
        && instanceValue
        && !(renderError && error)
			) {
				return (
					<div
						class={`no-suggestions ${getClassName(innerClass, 'noSuggestion')}`}
					>
						{typeof renderNoSuggestion === 'function'
							? renderNoSuggestion(instanceValue)
							: renderNoSuggestion}
					</div>
				);
			}
			return null;
		},
		renderErrorComponent() {
			const { innerClass, error, loading, instanceValue } = this.$props;
			const renderError
        = this.$scopedSlots.renderError || this.$props.renderError;
			if (error && renderError && instanceValue && !loading) {
				return (
					<div class={getClassName(innerClass, 'error')}>
						{typeof renderError === 'function'
							? renderError(error)
							: renderError}
					</div>
				);
			}
			return null;
		},
		clearValue() {
			this.setValue({ value: '', isOpen: false, triggerCustomQuery: true });
			this.onValueSelectedHandler(null, causes.CLEAR_VALUE);
		},
		handleSearchIconClick() {
			const { instanceValue } = this.$props;
			if (instanceValue.trim()) {
				this.setValue({
					value: instanceValue,
					isOpen: false,
					triggerCustomQuery: true
				});
				this.onValueSelectedHandler(instanceValue, causes.SEARCH_ICON_CLICK);
			}
		},
		getBackgroundColor(highlightedIndex, index) {
			return highlightedIndex === index ? '#eee' : '#fff';
		},
		getComponent(downshiftProps = {}, isPopularSuggestionsRender = false) {
			const {
				instanceValue,
				loading,
				error,
				results,
				recentSearches
			} = this.$props;
			const popularSuggestionsList = this.getPopularSuggestionsList();
			const suggestionsList = this.getSuggestionsList();
			const data = {
				loading,
				error,
				value: instanceValue,
				downshiftProps,
				data: suggestionsList,
				promotedData: results.promotedData,
				customData: results.customData,
				resultStats: this.stats,
				rawData: results.rawData,
				recentSearches,
				popularSuggestions: popularSuggestionsList,
				triggerClickAnalytics: this.triggerClickAnalytics
			};
			if (isPopularSuggestionsRender) {
				return getPopularSuggestionsComponent(
					{
						downshiftProps,
						data: popularSuggestionsList,
						value: instanceValue,
						loading,
						error
					},
					this
				);
			}
			return getComponent(data, this);
		},
		focusSearchBox(event) {
			const elt = event.target || event.srcElement;
			const { tagName } = elt;
			if (
				elt.isContentEditable
        || tagName === 'INPUT'
        || tagName === 'SELECT'
        || tagName === 'TEXTAREA'
			) {
				// already in an input
				return;
			}
			this.$refs.searchInputField.focus();
		},
		onKeyDown(event) {
			const { focusShortcuts = ['/'] } = this.$props;
			if (
				isEmpty(focusShortcuts)
        || (this.shouldUtilizeHotkeysLib && typeof this.hotkeys === 'function')
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
			const which = event.which || event.keyCode;
			const chrCode = which - 48 * Math.floor(which / 48);
			if (shortcuts.indexOf(which >= 96 ? chrCode : which) === -1) {
				// not the right shortcut
				return;
			}
			this.focusSearchBox(event);
			event.stopPropagation();
			event.preventDefault();
		},
		withTriggerQuery(eventName, event) {
			this.$emit(eventName, this.getComponentInstance(), event);
		},
		registerHotkeysListener() {
			const { focusShortcuts } = this.$props;
			if (
				!this.shouldUtilizeHotkeysLib
        || !(typeof this.hotkeys === 'function')
        || isEmpty(focusShortcuts)
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
		}
	},

	render() {
		const {
			className,
			innerClass,
			showIcon,
			showClear,
			showVoiceSearch,
			iconPosition,
			title,
			defaultSuggestions,
			autosuggest,
			placeholder,
			autoFocus,
			innerRef,
			size,
			instanceValue,
			recentSearches,
			expandSuggestionsContainer
		} = this.$props;
		const { recentSearchesIcon, popularSearchesIcon } = this.$scopedSlots;
		const suggestionsList = this.getSuggestionsList();
		const popularSuggestionsList = this.getPopularSuggestionsList();
		const hasSuggestions
      = (defaultSuggestions && defaultSuggestions.length)
      || (recentSearches && recentSearches.length);

		return (
			<div class={className}>
				{title && (
					<Title class={getClassName(innerClass, 'title') || ''}>{title}</Title>
				)}
				{hasSuggestions || autosuggest ? (
					<DownShift
						id="searchbox-downshift"
						handleChange={this.onSuggestionSelected}
						handleMouseup={this.handleStateChange}
						isOpen={this.isOpen}
						scopedSlots={{
							default: ({
								getInputEvents,
								getInputProps,
								getItemProps,
								getItemEvents,
								isOpen,
								highlightedIndex
							}) => {
								const renderSuggestionsContainer = () => {
									return (
										<div>
											{this.hasCustomRenderer
                        && this.getComponent({
                        	isOpen,
                        	getItemProps,
                        	getItemEvents,
                        	highlightedIndex
                        })}
											{this.renderErrorComponent()}
											{!this.hasCustomRenderer && isOpen ? (
												<ul
													class={`${suggestionsStyle} ${getClassName(
														innerClass,
														'list'
													)}`}
												>
													{suggestionsList.slice(0, size).map((item, index) => (
														<li
															{...{
																domProps: getItemProps({ item })
															}}
															{...{
																on: getItemEvents({
																	item
																})
															}}
															key={`${index + 1}-${item.value}`}
															style={{
																backgroundColor: this.getBackgroundColor(
																	highlightedIndex,
																	index
																)
															}}
														>
															<SuggestionItem
																currentValue={instanceValue}
																suggestion={item}
															/>
														</li>
													))}
													{!instanceValue
														? (recentSearches || []).map((sugg, index) => (
															<li
																{...{
																	domProps: getItemProps({
																		item: sugg
																	})
																}}
																{...{
																	on: getItemEvents({
																		item: sugg
																	})
																}}
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
																			getClassName(
																				innerClass,
																				'recent-search-icon'
																			) || null
																		}
																		icon={recentSearchesIcon}
																		type="recent-search-icon"
																	/>
																</div>
																<SuggestionItem
																	currentValue={instanceValue}
																	suggestion={sugg}
																/>
															</li>
														))
														: null}
													{hasPopularSuggestionsRenderer(this)
														? this.getComponent(
															{
																isOpen,
																getItemProps,
																getItemEvents,
																highlightedIndex
															},
															true
														)
														: (popularSuggestionsList || []).map(
															(sugg, index) => (
																<li
																	{...{
																		domProps: getItemProps({
																			item: sugg
																		})
																	}}
																	{...{
																		on: getItemEvents({
																			item: sugg
																		})
																	}}
																	key={`${
																		index
                                      + suggestionsList.length
                                      + (!instanceValue
                                      	? recentSearches.length
                                      	: 0 )+ 1
																	}-${sugg.value}`}
																	style={{
																		backgroundColor: this.getBackgroundColor(
																			highlightedIndex,
																			index
                                          + suggestionsList.length
                                          + (!instanceValue
                                          	? recentSearches.length
                                          	: 0)
																		),
																		justifyContent: 'flex-start'
																	}}
																>
																	<div style={{ padding: '0 10px 0 0' }}>
																		<CustomSvg
																			iconId={`${index + 1}-${
																				sugg.value
																			}-icon`}
																			className={
																				getClassName(
																					innerClass,
																					'popular-search-icon'
																				) || null
																			}
																			icon={popularSearchesIcon}
																			type="popular-search-icon"
																		/>
																	</div>
																	<SuggestionItem
																		currentValue={instanceValue}
																		suggestion={sugg}
																	/>
																</li>
															)
														)}
												</ul>
											) : (
												this.renderNoSuggestionComponent()
											)}
										</div>
									);
								};
								return (
									<div class={suggestionsContainer}>
										<InputGroup>
											{this.renderInputAddonBefore()}
											<InputWrapper>
												<Input
													ref="searchInputField"
													showIcon={showIcon}
													showClear={showClear}
													showVoiceSearch={showVoiceSearch}
													iconPosition={iconPosition}
													class={getClassName(innerClass, 'input')}
													placeholder={placeholder}
													currentValue={instanceValue}
													autoFocus={autoFocus}
													{...{
														on: getInputEvents({
															onInput: this.onInputChange,
															onBlur: e => {
																this.withTriggerQuery('blur', e);
															},
															onFocus: this.handleFocus,
															onKeyPress: e => {
																this.withTriggerQuery('keyPress', e);
															},
															onKeyDown: e =>
																this.handleKeyDown(e, highlightedIndex),
															onKeyUp: e => {
																this.withTriggerQuery('keyUp', e);
															}
														})
													}}
													{...{
														domProps: getInputProps({
															value: instanceValue || ''
														})
													}}
												/>
												{this.renderIcons()}
												{!expandSuggestionsContainer
                          && renderSuggestionsContainer()}
											</InputWrapper>
											{this.renderInputAddonAfter()}
										</InputGroup>
										{expandSuggestionsContainer && renderSuggestionsContainer()}
									</div>
								);
							}
						}}
					/>
				) : (
					<div class={suggestionsContainer}>
						<InputGroup>
							{this.renderInputAddonBefore()}
							<InputWrapper>
								<Input
									ref="searchInputField"
									class={getClassName(innerClass, 'input') || ''}
									placeholder={placeholder}
									autoFocus={autoFocus}
									{...{
										on: {
											blur: e => {
												this.$emit('blur', e);
											},
											keypress: e => {
												this.$emit('keyPress', e);
											},
											input: this.onInputChange,
											focus: e => {
												this.$emit('focus', e);
											},
											keydown: e => {
												this.$emit('keyDown', e);
											},
											keyup: e => {
												this.$emit('keyUp', e);
											}
										}
									}}
									{...{
										domProps: {
											autofocus: autoFocus,
											value: instanceValue || ''
										}
									}}
									iconPosition={iconPosition}
									showIcon={showIcon}
									showClear={showClear}
									showVoiceSearch={showVoiceSearch}
									innerRef={innerRef}
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
};

const SearchBoxWrapper = {
	name: 'search-box-wrapper',
	functional: true,
	render(h, context) {
		return (
			<SearchComponent
				value=""
				triggerQueryOnInit={!!context.props.enablePopularSuggestions}
				clearOnQueryChange={true}
				{...{
					on: context.listeners,
					props: context.props,
					scopedSlots: {
						default: ({
							loading,
							error,
							micStatus,
							results,
							value,
							recentSearches
						}) => {
							return (
								<SearchBox
									loading={loading}
									error={error}
									micStatus={micStatus}
									results={results}
									recentSearches={recentSearches}
									instanceValue={value}
									{...{
										attrs: context.data.attrs,
										on: context.listeners,
										scopedSlots: context.scopedSlots,
										slots: context.slots
									}}
								/>
							);
						}
					}
				}}
				subscribeTo={[
					'micStatus',
					'error',
					'requestPending',
					'results',
					'value',
					'recentSearches'
				]}
			/>
		);
	}
};

SearchBoxWrapper.install = function(Vue) {
	Vue.component(SearchBox.name, SearchBoxWrapper);
};

export default SearchBoxWrapper;
