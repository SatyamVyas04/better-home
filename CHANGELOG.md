# Changelog

## [1.10.1](https://github.com/SatyamVyas04/better-home/compare/v1.10.0...v1.10.1) (2026-04-25)

### Bug Fixes

* **calendar:** adjust layout for better responsiveness and styling in interactive calendar ([a445342](https://github.com/SatyamVyas04/better-home/commit/a445342570aeec4ae0bb43897912e328c3cd58f6))

## [1.10.0](https://github.com/SatyamVyas04/better-home/compare/v1.9.0...v1.10.0) (2026-04-25)

### Features

* enhance calendar functionality with year selection and dynamic month rendering ([1291993](https://github.com/SatyamVyas04/better-home/commit/129199317f2203d57fe0b69312a7e7647303e02e))

### Bug Fixes

* **release:** update hook from after:bump to after:changelog for manifest synchronization ([c6e65bd](https://github.com/SatyamVyas04/better-home/commit/c6e65bd4b072f1ffcea8955a7f7240c223595037))
* **storage:** major undo-redo data wipe-out bug fix ([c3fb0a1](https://github.com/SatyamVyas04/better-home/commit/c3fb0a1fe061873c52b2ee8df08284521d3ba6b6))
* update release notification to link to GitHub releases and simplify changelog handling ([dc876c1](https://github.com/SatyamVyas04/better-home/commit/dc876c11640447800c2aec212794f229936b655a))

## [1.9.0](https://github.com/SatyamVyas04/better-home/compare/v1.8.0...v1.9.0) (2026-04-21)

### Features

* add engagement notifications and changelog handling ([864c16f](https://github.com/SatyamVyas04/better-home/commit/864c16f60806a24ccd2a2117647490889f1a2253))
* add mascots for engagement notifications and update toast visuals ([056d461](https://github.com/SatyamVyas04/better-home/commit/056d46142c8499eaaf57a79b676cbc0bcbc8c47b))
* refine compact and mobile views ([0cef03d](https://github.com/SatyamVyas04/better-home/commit/0cef03da4043415cc7630d01c44f156e254e769e))

### Bug Fixes

* added better quotes, for the quotes widget ([f36370e](https://github.com/SatyamVyas04/better-home/commit/f36370ed6f86225bc3655d335818a035c9e5066b))
* enhance engagement notifications with improved feedback prompt handling and UI adjustments ([0a698be](https://github.com/SatyamVyas04/better-home/commit/0a698bee55f1b6f3e9d3240b59e12c54578b12b2))

## [1.8.0](https://github.com/SatyamVyas04/better-home/compare/v1.7.4...v1.8.0) (2026-04-17)

### Features

* **quotes:** add rotating neon quotes widget ([ccc9c4d](https://github.com/SatyamVyas04/better-home/commit/ccc9c4dfa22a83acdb887d01c5f95f7d210c5ca7))

### Bug Fixes

* **storage:** remove missing keys on restore ([c555fc5](https://github.com/SatyamVyas04/better-home/commit/c555fc50c31c49c75cf3d80aa92a6cb5928b28a2))
* **vite:** initialize theme before app mount ([c1d803b](https://github.com/SatyamVyas04/better-home/commit/c1d803b85eb298b2538e6dcdc3457ae17e9036c7))

## [1.7.4](https://github.com/SatyamVyas04/better-home/compare/v1.7.3...v1.7.4) (2026-04-15)

### Bug Fixes

* add fallback image URL for X platform and improve YouTube description fetching ([98074d6](https://github.com/SatyamVyas04/better-home/commit/98074d64441ba5910a42371fc3b17756b7492af6))
* update references to Twitter as X and adjust related functionality ([9eb382d](https://github.com/SatyamVyas04/better-home/commit/9eb382d0f2fe2f5b0156a84db8387d0656763af0))

## [1.7.3](https://github.com/SatyamVyas04/better-home/compare/v1.7.2...v1.7.3) (2026-04-15)

### Bug Fixes

* comment out host_permissions in manifest.json ([3abcc2b](https://github.com/SatyamVyas04/better-home/commit/3abcc2b413c00123c922fd08eae11c2884b54180))

## [1.7.2](https://github.com/SatyamVyas04/better-home/compare/v1.7.1...v1.7.2) (2026-04-15)

### Bug Fixes

* update host_permissions in manifest.json ([62f7fa5](https://github.com/SatyamVyas04/better-home/commit/62f7fa50e61e4f6cecf01e03e31e65a17277da14))

## [1.7.1](https://github.com/SatyamVyas04/better-home/compare/v1.7.0...v1.7.1) (2026-04-15)

### Bug Fixes

* update host_permissions to optional_host_permissions in manifest.json ([7508f3a](https://github.com/SatyamVyas04/better-home/commit/7508f3afdc407251089f445acd707d877f305991))

## [1.7.0](https://github.com/SatyamVyas04/better-home/compare/v1.6.0...v1.7.0) (2026-04-14)

### Features

* add link preview utility functions ([b96bfd5](https://github.com/SatyamVyas04/better-home/commit/b96bfd58505dca4a67f74791c53be73a82ab3b22))
* enhance quick links preview functionality with hydration and storage management ([81ad0af](https://github.com/SatyamVyas04/better-home/commit/81ad0afb3ed081be3082a1d86777565a098a79fd))
* implement autosave backup flushing and restore preview hints in backup widget ([99fc919](https://github.com/SatyamVyas04/better-home/commit/99fc91929df2df8ce93aad79c286e6d9a51dc336))
* modularize quick-links architecture and preview interactions ([05b8678](https://github.com/SatyamVyas04/better-home/commit/05b8678fa1739dd5aa67bd2e31b445e253615b24))
* session history for user actions ([edb7d58](https://github.com/SatyamVyas04/better-home/commit/edb7d5856f96f2eedc3c9daac1a4418d59c8d506))

### Bug Fixes

* apply review feedback and restructure quick-links directory ([d9a6339](https://github.com/SatyamVyas04/better-home/commit/d9a633975f1108fbaf3ec83af931a5c21a9b7797))
* apply review feedback on import controller, image cache, and warmup ([8b1ed11](https://github.com/SatyamVyas04/better-home/commit/8b1ed11f6dc1dc703baecbd2832300756305dd4e))
* include quick-links preview cache in storage keys ([321a96a](https://github.com/SatyamVyas04/better-home/commit/321a96ae760676cc54f6352942f0353cfea363ee))
* set backup location permissions on select and treat load as location setup ([9c5f3bc](https://github.com/SatyamVyas04/better-home/commit/9c5f3bcbab30381e6f99f2139a1830295b09d2eb))
* update release hooks to include popup.html and ensure version meta tag is present ([da31c4c](https://github.com/SatyamVyas04/better-home/commit/da31c4c7494b6e1c1345eb0de8f6d2c5074ed6e1))

## [1.6.0](https://github.com/SatyamVyas04/better-home/compare/v1.5.0...v1.6.0) (2026-04-11)

### Features

* implement storage migration functionality and update popup UI ([f003e64](https://github.com/SatyamVyas04/better-home/commit/f003e6420f404d3c6dafc736cca8c6a583bf5e9d))

### Bug Fixes

* update loader names and adjust button styling for BackupWidget ([c99cccd](https://github.com/SatyamVyas04/better-home/commit/c99cccded93f87c01492659caa581dc4c2f1e1bd))

## [1.5.0](https://github.com/SatyamVyas04/better-home/compare/v1.4.0...v1.5.0) (2026-04-03)

### Features

* add context menu for sorting and managing duplicates in quick links ([9eeb782](https://github.com/SatyamVyas04/better-home/commit/9eeb782ae0a21b768d608abf5912b9084e634743))
* add lina.sameer.sh-inspired ScrollArea with touch support and configurable mask height ([b178bb8](https://github.com/SatyamVyas04/better-home/commit/b178bb86bc2e91f4c51b4b74b901448c96543e09))

### Bug Fixes

* enhance focus styles and transitions for todo and quick-links widgets ([ca1edcc](https://github.com/SatyamVyas04/better-home/commit/ca1edccc09475d6557ef6aff0e6c87ba1526b359))
* update padding in textarea for better usability in todo list ([76dfa48](https://github.com/SatyamVyas04/better-home/commit/76dfa48e6de734e44909bfce3dcfb096465f8b23))

## [1.4.0](https://github.com/SatyamVyas04/better-home/compare/v1.3.0...v1.4.0) (2026-03-31)

### Features

* add todo groups and inline editing ([ba2a6c5](https://github.com/SatyamVyas04/better-home/commit/ba2a6c5a9e57e511ec4bbcae18776b857e63ce17))
* added skills for react best practises and design animations ([53b2865](https://github.com/SatyamVyas04/better-home/commit/53b2865bdfbb622133d7c8b407704c8d2333b92c))
* enhance todo editing experience with dynamic textarea resizing ([a7edfc3](https://github.com/SatyamVyas04/better-home/commit/a7edfc346328a040fe8677eb7b2984851cddfa47))
* implement grouping functionality for todos with collapsible sections ([efc71e5](https://github.com/SatyamVyas04/better-home/commit/efc71e5bdafe22b364c1f21ea51ca1275f850494))
* optimize component performance with useMemo and useCallback ([9413349](https://github.com/SatyamVyas04/better-home/commit/9413349b5981acc4ffe282cad5616081cd862f20))
* update todo group colors to use lighter shades in oklch color format ([4ca5db4](https://github.com/SatyamVyas04/better-home/commit/4ca5db4f223eef0f2dd76efb1730e0c6525998d5))

### Bug Fixes

* update path resolution to use import.meta.dirname for compatibility ([82e81b9](https://github.com/SatyamVyas04/better-home/commit/82e81b9571ca4a705545318ed8730cf1dc9685e7))

## [1.3.0](https://github.com/SatyamVyas04/better-home/compare/v1.2.2...v1.3.0) (2026-02-01)

### Features

* add context menu functionality and enhance todo list features ([dd4c1f6](https://github.com/SatyamVyas04/better-home/commit/dd4c1f6b9a0728dcaae21c0bbdc46010aa304852))
* refactor calendar components and add hold-to-clear functionality ([758e2e6](https://github.com/SatyamVyas04/better-home/commit/758e2e60bbba64a8e8c91fa249938041ce3d433f))

### Bug Fixes

* adjust spacing and styling in todo list component for improved UI ([e722cdf](https://github.com/SatyamVyas04/better-home/commit/e722cdf7bbe6c51e25261d46f3235f4a420044b0))

## [1.2.2](https://github.com/SatyamVyas04/better-home/compare/v1.2.1...v1.2.2) (2026-01-21)

### Bug Fixes

* improve backup and restore functionality for local storage ([1734bdd](https://github.com/SatyamVyas04/better-home/commit/1734bdd4222d046c9e458eec57d37f11c60a8b77))
* remove storage permission from manifest ([8e747ae](https://github.com/SatyamVyas04/better-home/commit/8e747aeb0ef52692d91b60f1a12554d015bf0106))

## [1.2.1](https://github.com/SatyamVyas04/better-home/compare/v1.2.0...v1.2.1) (2026-01-14)

### Bug Fixes

* normalize card spacing and padding across all widgets ([49d444e](https://github.com/SatyamVyas04/better-home/commit/49d444e212dad1452f18a3e0e36fc5b9dcc7703f))

## [1.2.0](https://github.com/SatyamVyas04/better-home/compare/v1.1.0...v1.2.0) (2026-01-14)

### Features

* enhance MonthGrid layout and add today highlight animation ([d4ca390](https://github.com/SatyamVyas04/better-home/commit/d4ca3901361569deb8304437026b9c44f830433e))
* improve theme system, animations, and UI consistency ([d23be20](https://github.com/SatyamVyas04/better-home/commit/d23be2011f00e3d7267a5866b5a20b7d0071f664))
* update MonthGrid styles and improve layout responsiveness ([4bf9b97](https://github.com/SatyamVyas04/better-home/commit/4bf9b97e76bebe3ab382be328a3743525025a109))

## [1.1.0](https://github.com/SatyamVyas04/better-home/compare/v1.0.2...v1.1.0) (2026-01-13)

### Features

* add release automation with asset packaging ([70e8501](https://github.com/SatyamVyas04/better-home/commit/70e85014dbb5d776faa74d32cca6ee4bee4454f7))
* enhance release packaging with archiver for ZIP and TAR.GZ creation ([88de5c8](https://github.com/SatyamVyas04/better-home/commit/88de5c8897980dafe5ce3bba3dd6b4254d47fb5d))
