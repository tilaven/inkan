# checkout (service)

A stand-in for a service repository that keeps its own decision records under `docs/decisions/`.
The hub lists them as the project "checkout" through the `sources` entry in `inkan.config.ts`;
in a real setup this folder would be another repository (`repo: 'git@github.com:acme/checkout.git'`).
