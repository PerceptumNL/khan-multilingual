#!/usr/bin/python
# -*- coding: utf-8 -*-
# use json in Python 2.7, fallback to simplejson for Python 2.5

try:
    import json
except ImportError:
    import simplejson as json

from google.appengine.ext.webapp.util import run_wsgi_app
import webapp2

# It's important to have this prior to the imports below that require imports
# to request_handler.py. The structure of the imports are such that this
# module causes a lot of circular imports to happen, so including it once out
# the way at first seems to fix some of those issues.

import request_cache
from gae_mini_profiler import profiler
from gae_bingo.middleware import GAEBingoWSGIMiddleware

import request_handler
import user_util

import wsgi_compat


class ShowJson(request_handler.RequestHandler):
    @user_util.open_access
    def get(self, language, namespace):
        self.response.headers['Content-Type'] = "application/json"
        # self.response.out.write("{lang: " + language + ", 'namespace': " + namespace+"}");
        self.response.out.write("{'lang': " + language + ", 'namespace': " + namespace+"}");


application = webapp2.WSGIApplication([
                                          ('/locale/(.*)/(.*)', ShowJson),
                                      ], debug=True)

application = profiler.ProfilerWSGIMiddleware(application)
application = GAEBingoWSGIMiddleware(application)
application = request_cache.RequestCacheMiddleware(application)
application = wsgi_compat.WSGICompatHeaderMiddleware(application)


def main():
    run_wsgi_app(application)


if __name__ == '__main__':
    main()
