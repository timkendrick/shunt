'use strict';

$(document).ready(function(){
	initStickyNav();
	initOnePageNav();
	initSelectNav();
	initSmoothScroll();
	initFooterHeight();
	initFileFilters();


	function initStickyNav() {
		$('#mainnav').sticky({ topSpacing: 0 });
	}

	function initOnePageNav() {
		$('#fluid-nav').onePageNav({
			currentClass: 'current',
			changeHash: false,
			scrollSpeed: 750,
			scrollOffset: 30,
			scrollThreshold: 0.5,
			filter: ':not(.external)',
			easing: 'swing'
		});
	}

	function initSelectNav() {
		selectnav('fluid-nav', {
			nested: false,
			label: false
		});
	}

	function initSmoothScroll() {
		$(document).on('click', '.scroll-link:not(.external)', function(event) {
			event.preventDefault();
			var $element = $(this);
			var targetSelector = $element.attr('href');
			var $targetElement = $(targetSelector);
			$('html, body').animate({
				scrollTop: $targetElement.offset().top + 'px'
			}, {
				duration: 500,
				easing: 'swing'
			});
		});
	}

	function initFooterHeight() {
		var footerHeight = 0;
		updateFooterHeight();
		$(window).on('resize', function() {
			updateFooterHeight();
		});


		function updateFooterHeight() {
			var updatedFooterHeight = $('footer').outerHeight();
			if (updatedFooterHeight === footerHeight) { return; }
			footerHeight = updatedFooterHeight;
			$('.pages').css('paddingBottom', footerHeight);
		}
	}

	function initFileFilters() {
		$(document).on('click', '.page .option-set a', function(event) {
			event.preventDefault();

			var $element = $(this);
			var $optionSet = $element.closest('.option-set');
			var $group = $element.closest('.page');

			var isAlreadySelected = $element.hasClass('selected');
			if (isAlreadySelected) { return false; }

			$optionSet.find('.selected').removeClass('selected');
			$element.addClass('selected');

			var filterSelector = $element.attr('data-option-value');
			$group.find('.post').each(function(index, element) {
				var $element = $(element);
				$element.toggleClass('hidden', !$element.is(filterSelector));
			});

			return false;
		});
	}
});
