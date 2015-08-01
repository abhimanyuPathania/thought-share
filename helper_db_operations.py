# helper_db_operations defines the common functionality that uses
# db queries and not simple get,put from keys

import time
import logging

from google.appengine.ext import ndb
from google.appengine.datastore.datastore_query import Cursor

from models import *
from helper_operations import add_user_name_image

def get_feed(cursor_str, group_id = None, user_id = None, add_poster = True):

	#  fetch_page_tuple (results, cursor, more)
	cursor = None
	if cursor_str:
		cursor = Cursor(urlsafe = cursor_str)

	fetch_page_tuple = GroupPost.fetch_posts(group_id = group_id,
											 user_id= user_id,
											 cursor = cursor)

	#post list - list of GroupPost entities
	feed_result = {
		'post_list': fetch_page_tuple[0],
		# in case of no posts, the cursor returned is None and calling urlsafe
		# on it causes exception
		'cursor_str': (fetch_page_tuple[1].urlsafe() if fetch_page_tuple[1] else None),
		'more': fetch_page_tuple[2]
	}

	if not feed_result['post_list']:
		return feed_result

	feed = []
	user_key_list = []
	for post in feed_result['post_list']:
		p = post.to_dict()
		p['post_id'] = post.key.urlsafe()
		feed.append(p)

		#also make a list of keys users who posted
		user_key = ndb.Key(User, post.user_id)
		user_key_list.append(user_key)

	#add updated user names and images if add_poster is True
	#added by default
	if add_poster:
		feed = add_user_name_image(feed, user_key_list)

	feed_result['post_list'] = feed
	return feed_result

def update_group_feed(group_id, timestamp):
	group_posts = GroupPost.fetch_post_updates(group_id, timestamp)

	if not group_posts:
		return None

	updates = []
	user_key_list = []
	for post in group_posts:
		p = post.to_dict()
		p["post_id"] = post.key.urlsafe()
		updates.append(p)

		#also make a list of keys users who posted
		user_key = ndb.Key(User, post.user_id)
		user_key_list.append(user_key)

	updates = add_user_name_image(updates, user_key_list)
	return updates


