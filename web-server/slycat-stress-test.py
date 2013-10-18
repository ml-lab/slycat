# Copyright 2013, Sandia Corporation. Under the terms of Contract
# DE-AC04-94AL85000 with Sandia Corporation, the U.S. Government retains certain
# rights in this software.

from selenium import webdriver
from selenium.webdriver.support import expected_conditions
from selenium.webdriver.support.ui import WebDriverWait
from selenium.common.exceptions import NoSuchElementException, TimeoutException

import argparse
import getpass
import json
import requests
import time
import urlparse

parser = argparse.ArgumentParser()
parser.add_argument("--url", default="https://localhost:8092", help="Root Slycat URL to test.  Default: %(default)s")
parser.add_argument("--user", default=getpass.getuser(), help="Slycat username.  Default: %(default)s")
arguments = parser.parse_args()

scheme, netloc, path, params, query, fragment = url = urlparse.urlparse(arguments.url)
netloc = "{}:{}@{}".format(arguments.user, getpass.getpass("{} password: ".format(arguments.user)), netloc)
url = urlparse.urlunparse((scheme, netloc, path, params, query, fragment))

try:
  browser = webdriver.Firefox()
except:
  raise Exception("Error starting web browser.  This is likely due to network proxy configuration, try clearing the http_proxy environment variable if set.")

browser.get(url)
WebDriverWait(browser, 10).until(expected_conditions.title_contains("Slycat Projects"))

model_count = 0
project_index = 0
while True:
  project_links = browser.find_elements_by_class_name("project-link")
  if len(project_links) < 1:
    break
  project_link = project_links[project_index % len(project_links)]
  project_link.click()
  WebDriverWait(browser, 10).until(expected_conditions.title_contains("Slycat Project"))

  model_index = 0
  while True:
    model_links = browser.find_elements_by_class_name("model-link")
    if model_index >= len(model_links):
      break
    model_link = model_links[model_index % len(model_links)]
    model_link.click()
    WebDriverWait(browser, 10).until(expected_conditions.title_contains("Model"))

    try:
      status_messages =  browser.find_element_by_id("status-messages")
      WebDriverWait(browser, 2).until(expected_conditions.visibility_of(status_messages))
      # This is an incomplete CCA model.
    except TimeoutException:
      # This is a complete CCA model.
      time.sleep(8)
    except NoSuchElementException:
      # This is not a CCA model.
      pass

    model_count += 1
    print "Viewed %s models" % model_count

    browser.back()
    WebDriverWait(browser, 10).until(expected_conditions.title_contains("Slycat Project"))
    model_index += 1

  browser.back()
  WebDriverWait(browser, 10).until(expected_conditions.title_contains("Slycat Projects"))
  project_index += 1
browser.quit()

