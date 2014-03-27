/* jshint jquery: true */
(function() {
	'use strict';

	$(function() {
		_initInputParsers();
		_initDataBindings();
		_initInputValidators();
		_initDropkick();
	});

	function _initInputParsers() {
		var attributeName = 'data-parser';

		var $inputElements = $('[' + attributeName + ']');

		var parsers = {
			'slug': function(value) {
				return value.toLowerCase().replace(/['"‘’“”]/g, '').replace(/[^a-z0-9]+/g, '-');
			}
		};

		_createInputParsers($inputElements, attributeName, parsers);


		function _createInputParsers($inputElements, attributeName, parsers) {
			$inputElements.each(function(index, inputElement) {
				var $inputElement = $(inputElement);

				var parserId = $inputElement.attr(attributeName);
				if (!(parserId in parsers)) { throw new Error('Invalid parser specified: "' + parserId + '"'); }
				
				var parser = parsers[parserId];
				_addParserListeners($inputElement, parser);
			});

			function _addParserListeners($inputElement, parser) {
				$inputElement.on('input change', _handleInputUpdated);

				function _handleInputUpdated(event) {
					var inputValue = $inputElement.val();
					var parsedValue = parser(inputValue);
					if (parsedValue === inputValue) { return; }
					$inputElement.val(parsedValue);
					$inputElement.change();
				}
			}
		}
	}

	function _initInputValidators() {
		var attributeName = 'data-validate';

		var $inputElements = $('[' + attributeName + ']');

		var validators = {
			'notEmpty': function(value) {
				return Boolean(value);
			},
			'slug': function(value) {
				return /^[a-z0-9\-]+$/.test(value);
			}
		};

		_createInputValidators($inputElements, attributeName, validators);

		function _createInputValidators($inputElements, attributeName, validators) {
			$inputElements.each(function(index, inputElement) {
				var $inputElement = $(inputElement);

				var validatorId = $inputElement.attr(attributeName);
				if (!(validatorId in validators)) { throw new Error('Invalid validator specified: "' + validatorId + '"'); }
				
				var validator = validators[validatorId];
				_addParserListeners($inputElement, validator);
			});

			function _addParserListeners($inputElement, validator) {
				$inputElement.on('input change blur', _handleInputUpdated);

				function _handleInputUpdated(event) {
					var inputValue = $inputElement.val();
					var isValid = validator(inputValue);
					$inputElement.parent().toggleClass('has-error', !isValid);
				}
			}
		}
	}

	function _initDataBindings() {
		var sourceAttributeName = 'data-bind-id';
		var targetAttributeName = 'data-bind-value';

		var $sourceElements = $('[' + sourceAttributeName + ']');
		var $targetElements = $('[' + targetAttributeName + ']');

		var filters = {
			'slug': function(value) {
				return value.toLowerCase().replace(/['"‘’“”]/g, '').replace(/[^a-z0-9]+/g, '-');
			},
			'format': function(value, formatString, emptyString) {
				if (!value && (arguments.length >= 3)) { return emptyString; }
				return formatString.replace(/\$0/g, value);
			}
		};

		var dataBindings = _createDataBindings($sourceElements, $targetElements, sourceAttributeName, targetAttributeName, filters);
		return dataBindings;


		function _createDataBindings($sourceElements, $targetElements, sourceAttributeName, targetAttributeName, filters) {
			var bindings = _createBindingSources($sourceElements, sourceAttributeName);
			_assignBindingTargets(bindings, $targetElements, targetAttributeName, filters);
			_updateAllBindings(bindings);

			return bindings;
			

			function _createBindingSources($sourceElements, sourceAttributeName) {
				var bindingSources = {};
				$sourceElements.each(function(index, sourceElement) {
					var $sourceElement = $(sourceElement);
					var sourceIdentifier = $sourceElement.attr(sourceAttributeName);
					bindingSources[sourceIdentifier] = _createDataBindingSource($sourceElement, sourceIdentifier);
				});
				return bindingSources;
			}

			function _assignBindingTargets(bindingSources, $targetElements, targetAttributeName, filters) {
				$targetElements.each(function(index, targetElement) {
					var $targetElement = $(targetElement);
					
					var bindingExpression = $targetElement.attr(targetAttributeName);
					var bindingExpressionSegments = /^\s*(!?)\s*\s*(.*?)(?:\s*\|\s*(.*?))?\s*$/.exec(bindingExpression);
					
					var bindingSourceInverted = Boolean(bindingExpressionSegments[1]);
					var bindingSourceId = bindingExpressionSegments[2];
					var bindingSource = bindingSources[bindingSourceId];
					if (!bindingSource) { throw new Error('Invalid binding expression: "' + bindingExpression + '"'); }

					var bindingFilterExpression = bindingExpressionSegments[3] || null;

					var filter = _getBindingFilter(bindingFilterExpression);
					if (bindingSourceInverted) { filter = _invertBindingFilter(filter); }
					
					bindingSource.bind($targetElement, filter);


					function _getBindingFilter(filterExpression) {
						if (!filterExpression) { return null; }

						var bindingFilterId = null;
						bindingFilterId = _parseFilterId(bindingFilterExpression);
						
						var bindingFilterExists = (bindingFilterId in filters);
						if (!bindingFilterExists) { throw new Error('Invalid binding expression: "' + bindingExpression + '"'); }
						
						var bindingFilterArguments = _parseFilterArguments(bindingFilterExpression);
						return _getFilter(bindingFilterId, bindingFilterArguments, filters);


						function _parseFilterId(filterExpression) {
							return /^\s*(.*?)(?:\s*\:\s*(.*?))?\s*$/.exec(filterExpression)[1];
						}

						function _parseFilterArguments(filterExpression) {
							var argumentsString = /^\s*(.*?)(?:\s*\:\s*(.*?))?\s*$/.exec(filterExpression)[2];
							if (!argumentsString) { return null; }
							var filterArguments = argumentsString.split(/\s*:\s*/);
							return filterArguments.map(function(filterArgument) {
								if (filterArgument === 'null') {
									return null;
								} else if (filterArgument === 'true') {
									return true;
								} else if (filterArgument === 'false') {
									return false;
								} else if (/^-?[0-9]+(?:\.[0-9]+)?$/.test(filterArgument)) {
									return Number(filterArgument);
								} else if (/^'.*'$/.test(filterArgument)) {
									return filterArgument.substr(1, filterArgument.length - 1 - 1);
								}
							});
						}

						function _getFilter(filterId, filterArguments, filters) {
							var filter = filters[bindingFilterId];
							if (!filterArguments || (filterArguments.length === 0)) { return filter; }
							return function(value) {
								return filter.apply(null, [value].concat(filterArguments));
							};
						}
					}

					function _invertBindingFilter(bindingFilter) {
						if (!bindingFilter) {
							return function(value) {
								return !value;
							};
						}
							
						return function(value) {
							var invertedValue = !value;
							return bindingFilter(invertedValue);
						};
					}
				});
			}

			function _updateAllBindings(bindingSources) {
				for (var bindingId in bindingSources) {
					var bindingSource = bindingSources[bindingId];
					bindingSource.update();
				}
			}


			function _createDataBindingSource($sourceElement, sourceIdentifier) {
				var value = _getCurrentValue($sourceElement);
				var bindingSource = {
					value: value,
					observers: [],
					bind: _bindTarget,
					unbind: _unbindTarget,
					update: _updateBindingValue
				};
				
				_addBindingListeners($sourceElement, bindingSource);

				return bindingSource;


				function _bindTarget($targetElement, filter) {
					var observers = bindingSource.observers;
					var observer = _createObserver($targetElement, filter);
					observers.push(observer);
				}

				function _unbindTarget($targetElement) {
					var observers = bindingSource.observers;
					
					if (!$targetElement) {
						observers.length = 0;
						return;
					}

					for (var i = 0; i < observers.length; i++) {
						var observer = observers[i];
						if (observer.element.is($targetElement)) {
							observers.splice(i--, 1);
						}
					}
				}

				function _updateBindingValue(value) {
					var valueWasSpecified = (arguments.length > 0);
					if (valueWasSpecified) {
						if (bindingSource.value === value) { return; }
						bindingSource.value = value;
					}

					bindingSource.observers.forEach(function(observer) {
						var value = bindingSource.value;
						if (observer.filter) { value = observer.filter(value); }
						_updateBindingTarget(observer.$element, value);
					});
				}

				function _createObserver($targetElement, filter) {
					return {
						$element: $targetElement,
						filter: filter || null
					};
				}

				function _addBindingListeners($sourceElement, bindingSource) {
					if ($sourceElement.is('input')) {
						$sourceElement.on('input change', _handleBindingUpdated);
					} else if ($sourceElement.is('textarea,select,option,button')) {
						$sourceElement.on('change', _handleBindingUpdated);
					}
					
					function _handleBindingUpdated() {
						var value = _getCurrentValue($sourceElement);
						bindingSource.update(value);
					}
				}

				function _getCurrentValue($sourceElement) {
					if ($sourceElement.is('input[type="radio"],input[type="checkbox"]')) {
						return $sourceElement.prop('checked');
					} else if ($sourceElement.is('button,input[type="submit"],input[type="reset"]')) {
						return !$sourceElement.prop('disabled');
					} else if ($sourceElement.is('input,textarea,select,option')) {
						return $sourceElement.val();
					} else {
						return $sourceElement.text();
					}
				}

				function _updateBindingTarget($targetElement, value) {
					if ($targetElement.is('input[type="radio"],input[type="checkbox"]')) {
						$targetElement.prop('checked', value && (value !== 'false'));
					} else if ($targetElement.is('button,input[type="submit"],input[type="reset"]')) {
						$targetElement.prop('disabled', !(value && (value !== 'false')));
					} else if ($targetElement.is('input,textarea,select,option')) {
						$targetElement.val(value);
						$targetElement.change();
					} else {
						$targetElement.text(value);
					}
				}
			}
		}
	}

	function _initDropkick() {
		var dropkick = window.dropkick;
		
		_initPurgeLinks(dropkick);


		function _initPurgeLinks(dropkick) {
			var attributeName = 'data-dropkick-purge';

			var $purgeButtonElements = $('[' + attributeName + ']');

			_createPurgeButtons($purgeButtonElements, attributeName, dropkick);


			function _createPurgeButtons($purgeButtonElements, attributeName, dropkick) {
				$purgeButtonElements.on('click', _handlePurgeButtonClicked);

				function _handlePurgeButtonClicked(event) {
					var $purgeButtonElement = $(event.currentTarget);
					var siteAlias = $purgeButtonElement.attr(attributeName);
					$purgeButtonElement.prop('disabled', true);
					$purgeButtonElement.addClass('-dropkick-sync-loading');
					dropkick.purgeSiteCache(siteAlias, _handleSiteCachePurged);


					function _handleSiteCachePurged(error) {
						$purgeButtonElement.prop('disabled', false);
						$purgeButtonElement.removeClass('-dropkick-sync-loading');

						if (error) {
							var errorTimeoutDuration = 3000;
							_setButtonState($purgeButtonElement, '-dropkick-sync-error', errorTimeoutDuration);
							return;
						}

						var successTimeoutDuration = 3000;
						_setButtonState($purgeButtonElement, '-dropkick-sync-success', successTimeoutDuration);


						function _setButtonState($element, className, timeoutDuration) {
							$element.prop('disabled', true);
							$element.addClass(className);
							setTimeout(function() {
								$element.prop('disabled', false);
								$element.removeClass(className);
							}, 3000);
						}
					}
				}
			}
		}
	}
})();