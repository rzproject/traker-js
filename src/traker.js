(function (w) {
    'use strict';
    var defaultOptions = {
            useHttps: true,
            sendReferrer: true,
            strictDoNotTrack: false
        },

    /**
     * Internal functions
     */

        /**
         * Send a request, currently using "GET" with an image ...
         */
        sendRequest = function (url) {
            // Might support POST later ...
            // For GET using an image (based on the real piwik.js library)
            var image = new Image(1, 1);
            image.src = url;
        },

        /**
         * Tries to find the value of the doNotTrack flag.
         * If no flag is found or not defined, will return undefined.
         * If the flag is OFF, it will return false.
         * If the flag is ON, it will return true
         */
        getDoNotTrack = function () {
            var value, dnt;
            if (window.navigator.doNotTrack !== undefined) {
                value = window.navigator.doNotTrack;
            } else if (window.navigator.msDoNotTrack !== undefined) {
                value = window.navigator.msDoNotTrack;
            }
            if (value) {
                if (value === 'yes' || value === '1') {
                    dnt = true;
                } else if (value === 'no' || value === '0') {
                    dnt = false;
                }
            }

            return dnt;
        },

        /**
         * Creates 16 random hexadecimal digits
         */
        randomHex = (function () {
            /* We want numbers from 0 - (2^32 - 1) */
            var maxInt32 = 4294967295,

            /* Pads a string with leading zero's so that it is at least 8 digits long */
                pad8 = function (text) {
                    var result = '00000000' + text;
                    return result.substring(result.length - 8);
                },

            /* Creates a "random" 32-bit integer and converts it to hexadecimal */
                rand32hex = function () {
                    /* Gets a random number from 0 to 2^32 - 1 and converts it to hex */
                    var randomNumber = Math.floor((maxInt32 * Math.random()) + 1);
                    return randomNumber.toString(16);
                };

            return function () {
                return pad8(rand32hex()) + pad8(rand32hex());
            };
        }()),

        /**
         * Gets an ID to uniquely identify a visitor (during a session)
         * If session storage is not available this will return a random ID every time
         * If session storage is available, this will return the same ID always for that session
         */
        getVisitorID = function () {
            var visitorID;

            if (typeof Storage !== "undefined") {
                visitorID = sessionStorage.getItem('rz-tracker-ID');
                if (visitorID === null) {
                    visitorID = randomHex();
                    sessionStorage.setItem('rz-tracker-ID', visitorID);
                }
            } else {
                // No session storage so just new random every time
                visitorID = randomHex();
            }

            return visitorID;
        },

        /**
         * Builds a URL based on the configured options
         * host: the hostname of the server where the API file is located
         * returns: the URL as a string
         */
        buildUrl = function (host, options) {
            var prefix = (options.useHttps ? 'https' : 'http') + '://',
                suffix = "/track";
            return (prefix + host + suffix);
        },

        /**
         * Gets the URL of the page we are currently on.
         * returns: the URL as a string
         */
        getCurrentUrl = function () {
            return window.location;
        },

        /**
         * Get's the title of the current page
         * returns: the title, of undefined is no title was found..
         */
        getCurrentTitle = function() {
            var titleTag = window.document.getElementsByTagName('title');
            if (titleTag.length > 0) {
                return titleTag[0].innerHTML;
            } else {
                return undefined;
            }
        },

        /**
         * Based on the parameters, builds a querystring for the tracking request.
         */
        buildQueryString = function (params) {
            // TODO: Handle invalid params!
            var result = '?', id;
            for (id in params) {
                if (params.hasOwnProperty(id)) {
                    result = result + id + '=' + encodeURIComponent(params[id]);
                    result = result + '&';
                }
            }

            // Last characters will be '?' or '&'
            result = result.substring(0, result.length - 1);
            return result;
        },

        /**
         * Will create a full options object with the provided options + the defaults
         * if an option was not provided.
         * options: an object with a set of relevant options (see docs)
         * returns: an object with all the options that are needed
         */
        createOptions = function (options) {
            var option, result = {};
            for (option in defaultOptions) {
                if (defaultOptions.hasOwnProperty(option)) {
                    if (options.hasOwnProperty(option)) {
                        result[option] = options[option];
                    } else if (defaultOptions.hasOwnProperty(option)) {
                        result[option] = defaultOptions[option];
                    }
                }
            }

            return result;
        },

        /**
         * Builds up the set of parameters to pass to YOUR API
         * idsite: the id of the site
         * options: the main set of tracker options
         * returns: an object with all parameters.
         */
        buildParameters = function (idsite, options) {
            var params = {}, action;

            /* Mandatory */
            params.idsite = idsite;
            params.rec = 1; // Always set to one ..
            params.url = getCurrentUrl();

            /* Recommended */
            action = getCurrentTitle();
            if (action !== undefined) {
                params.action_name = action;
            }
            params._id = getVisitorID();
            params.rand = Math.floor((Math.random() * 4294967295) + 1);
            params.apiv = 1;

            /* Optional */
            if (options.sendReferrer && document.referrer !== '') {
                params.urlref = document.referrer;
            }

            return params;
        },

    /**
     * Public Functions
     */

        /**
         * Will send tracking information to your API
         *  idsite: the id of the website you are tracking a visit for
         *  host: the hostname of where the API file is to send the tracking info to
         *  options:
         *      - useHttps (bool): whether to send the tracking request to https or http
         *      - sendReferrer (bool): whether or not to include the referrer in the tracking entry,
         *      - strictDoNotTrack (bool): if true, will only send tracking info if the tracking
         *          flag is explicitly set to "1" (or "Yes"). I don't think you'll get much tracking
         *          in that case though.
         */
        track = function (idsite, host, options) {
            var url, params, doNotTrack;

            // Check input
            if (!idsite || idsite !== parseInt(idsite, 10)) {
                console.error('rz-tracker: idsite passed to the track function was not a valid number.');
                return;
            }
            if (!host) {
                console.error('rz-tracker: no host was passed to the track function.');
                return;
            }

            // Get the set of options from the user and the defaulst for
            // all missing options.
            options = createOptions(options);

            // First, let's check the do not track flag.
            doNotTrack = getDoNotTrack();
            if (doNotTrack === true ||
                (options.strictDoNotTrack && doNotTrack === undefined)) {
                // User has do not track set on, or we don't know.
                // If mode is strict and we don't know, then don't track
                // If mode is not strict and we don't know, we'll track
                return;
            }

            /* Setting all rz-tracker parameters */
            params = buildParameters(idsite, options);

            /* Get the URL of the target /track */
            url = buildUrl(host, options);
            url = url + buildQueryString(params);

            /* Send the tracking request */
            sendRequest(url);
        };

    // Execute the track function automatically ...
    (function () {
        if (w._rzTracker) {
            // Call track with the parameters from window
            track(w._rzTracker.id, w._rzTracker.host, w._rzTracker.options);
        }
    }());
}(window));