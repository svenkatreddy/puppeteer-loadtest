workflow "publish to npm" {
  on = "push"
  resolves = ["test", "publish"]
}

action "test" {
  uses = "actions/npm@e7aaefe"
  args = "test"
}

action "publish" {
  uses = "actions/npm@e7aaefe"
  args = "publish"
  secrets = ["NPM_AUTH_TOKEN"]
  needs = ["test"]
}
