var ModalVideo = {
    template: Templates.get("video.modal-video"),
    modal: null,

    linkifyTooltip: function() {
        // We take the message in the title of the energy points box and place it
        // in a tooltip, and if it's the message with a link to the login we
        // replace it with a nicer link (we don't want to have to pass the url to
        // the templatetag).
        var $points = $(".video-energy-points");
        var loginUrl = $(".top-header-links a").filter(function(i, el) {
            return $(el).text() == "Login";
        }).attr("href");
        var title = ($points.attr("title") || $points.data("title"))
            .replace(/Sign in/, '<a href="' + loginUrl + '">Sign in</a>');
        $points.data("title", title).removeAttr("title");

        VideoStats.tooltip("#points-badge-hover", $points.data("title"));
    },

    hookup: function() {
        // ev.which doesn't work in IE<9 on click events, so get it from
        // ev.button on a mouseup event (which comes first)
        var mouseupButton = 0;

        // add click handlers to all related video links for lightbox
        jQuery(document).delegate("a.related-video", {
            mouseup: function(ev) {
                mouseupButton = ev.button;
                return true;
            },
            click: function(ev) {
                // workaround for IE<=8
                ev.which = ev.which || mouseupButton;
                mouseupButton = 0;

                if (ev.which == 1) {
                    // left mouse button: show modal video

                    var videoModel = $(ev.currentTarget).data("video");
                    if (!videoModel) {
                        // no video has been associated, this is probably an
                        // inline link from the exercise itself.
                        var youtubeId = $(ev.currentTarget).data("youtube-id");
                        if (youtubeId) {
                            videoModel = _.find(Khan.relatedVideos.videos, function(v) {
                                return v.youtubeId == youtubeId;
                            });
                        }
                    }

                    if (videoModel) {
                        ModalVideo.show(videoModel);
                        ev.preventDefault();
                        return false;
                    }
                }

                // anything else, probably middle mouse: follow the link
                return true;
            }
        });
    },

    init: function(video) {
        var context = {
            video: video,
            downloadUrl: video.downloadUrls && video.downloadUrls.mp4 || null,
            height: 480,
            width: 800,
            youtubeId: video.youtubeId,
            points: 0, // will be updated at end of .show()'s ajax request
            possible_points: 750, // VIDEO_POINTS_BASE in consts.py
            logged_in: !!USERNAME, // phantom users have empty string usernames
            video_url: window.Khan && Khan.relatedVideos && Khan.relatedVideos.makeHref(video) || video.relative_url
        };

        this.modal = $(this.template(context))
            .appendTo("body")
            .modal({
                keyboard: true,
                backdrop: true,
                show: false
            })
            .bind("hide", $.proxy(this.hide, this))
            .bind("hidden", $.proxy(this.hidden, this))
            .bind("shown", $.proxy(function() {
                // remove fade so that draggable is fast.
                this.modal.removeClass("fade");
            }, this));

        Video.init({});
        ModalVideo.linkifyTooltip();
        return this.modal;
    },

    show: function(video) {
        this.modal = this.init(video);
        this.modal.modal("show");
        VideoStats.startLoggingProgress(null, video.youtubeId);

        var apiUrl = "/api/v1/user/videos/" + video.youtubeId;
        $.ajax(apiUrl, {
            success: $.proxy(function(data) {
                var points = data ? data.points : 0;
                VideoStats.updatePointsSaved(points);
                VideoStats.updatePointsDisplay(points);
            }, this)
        });
    },

    // when the modal is hidden, we actually just destroy everything. This is
    // the simplest way to deal with external stuff like the youtube player and
    // subtitles scripts maintaining state when we don't want them to.
    hide: function() {
        VideoStats.stopLoggingProgress();
        Video.hideSubtitleElements();
        this.modal.addClass("fade");
    },

    hidden: function() {
        // destroy the subtitles elements
        $(".unisubs-videoTab").remove();
        $(".unisubs-dropdown").remove();
        // needed to allow the subtitle script to be reloaded
        window.UnisubsWidgetizerLoaded = false;

        this.modal.remove();
        this.modal = null;
    }
};

Handlebars.registerPartial("youtube-player", Templates.get("shared.youtube-player"));
