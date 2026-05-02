.PHONY: test test-api

test: test-api

test-api:
	python scripts/test_full_platform.py
