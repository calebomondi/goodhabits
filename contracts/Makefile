-include .env

SCRIPT      := script/DeployTreasury.s.sol:DeployTreasury
GRANT_SCRIPT   := script/GrantRoles.s.sol:GrantRoles
APPROVE_SCRIPT := script/ApproveStrategy.s.sol:ApproveStrategy

# Usage:
#   make deploy NETWORK=sepolia
#   make deploy NETWORK=mainnet
#   make deploy NETWORK=sepolia DRY_RUN=true
#   make deploy NETWORK=mainnet DRY_RUN=true

# Simulate granting roles
# make sim-grant-roles NETWORK=sepolia
# Submit the grantRole transactions
# make grant-roles NETWORK=sepolia

# ── Network selection ────────────────────────────────────────────────────────

ifeq ($(NETWORK),sepolia)
  RPC_URL := $(CELO_SEPOLIA_RPC_URL)
else ifeq ($(NETWORK),mainnet)
  RPC_URL := $(CELO_MAINNET_RPC_URL)
else
  RPC_URL :=
endif

# ── Targets ──────────────────────────────────────────────────────────────────

.PHONY: build test deploy

build:
	forge build

test:
	forge test

deploy:
	@if [ -z "$(NETWORK)" ]; then \
		echo "Error: NETWORK is required. Use NETWORK=sepolia or NETWORK=mainnet"; \
		exit 1; \
	fi
	@if [ -z "$(RPC_URL)" ]; then \
		echo "Error: RPC URL for network '$(NETWORK)' is not set in .env"; \
		exit 1; \
	fi
	@if [ "$(DRY_RUN)" = "true" ]; then \
		echo ">>> Simulating deployment on $(NETWORK) (no broadcast)..."; \
		forge script $(SCRIPT) \
			--rpc-url $(RPC_URL) \
			--gas-price 50000000000 \
			-vvvv; \
	else \
		echo ">>> Deploying to $(NETWORK)..."; \
		forge script $(SCRIPT) \
			--rpc-url $(RPC_URL) \
			--private-key $(PRIVATE_KEY_DEPLOYER) \
			--broadcast \
			--gas-price 50000000000 \
			--slow \
			--verify \
			--etherscan-api-key $(ETHERSCAN_API_KEY) \
			-vvvv; \
	fi

grant-roles:
	@if [ -z "$(NETWORK)" ]; then \
		echo "Error: NETWORK is required. Use NETWORK=sepolia or NETWORK=mainnet"; \
		exit 1; \
	fi
	@if [ -z "$(RPC_URL)" ]; then \
		echo "Error: RPC URL for network '$(NETWORK)' is not set in .env"; \
		exit 1; \
	fi
	@echo ">>> Granting STRATEGY_ROLE and SYNC_ROLE on $(NETWORK)..."; \
	forge script $(GRANT_SCRIPT) \
		--rpc-url $(RPC_URL) \
		--private-key $(PRIVATE_KEY_DEPLOYER) \
		--broadcast \
		--gas-price 50000000000 \
		--slow \
		--verify \
		-vvvv

sim-grant-roles:
	@if [ -z "$(NETWORK)" ]; then \
		echo "Error: NETWORK is required. Use NETWORK=sepolia or NETWORK=mainnet"; \
		exit 1; \
	fi
	@if [ -z "$(RPC_URL)" ]; then \
		echo "Error: RPC URL for network '$(NETWORK)' is not set in .env"; \
		exit 1; \
	fi
	@echo ">>> Simulating role grant on $(NETWORK) (no broadcast)..."; \
	forge script $(GRANT_SCRIPT) \
		--rpc-url $(RPC_URL) \
		--private-key $(PRIVATE_KEY_DEPLOYER) \
		--gas-price 50000000000 \
		-vvvv

approve-strategy:
	@if [ -z "$(NETWORK)" ]; then \
		echo "Error: NETWORK is required. Use NETWORK=sepolia or NETWORK=mainnet"; \
		exit 1; \
	fi
	@if [ -z "$(RPC_URL)" ]; then \
		echo "Error: RPC URL for network '$(NETWORK)' is not set in .env"; \
		exit 1; \
	fi
	@echo ">>> Approving backend as strategy on $(NETWORK)..."; \
	forge script $(APPROVE_SCRIPT) \
		--rpc-url $(RPC_URL) \
		--private-key $(PRIVATE_KEY_DEPLOYER) \
		--broadcast \
		--gas-price 50000000000 \
		--slow \
		-vvvv

sim-approve-strategy:
	@if [ -z "$(NETWORK)" ]; then \
		echo "Error: NETWORK is required. Use NETWORK=sepolia or NETWORK=mainnet"; \
		exit 1; \
	fi
	@if [ -z "$(RPC_URL)" ]; then \
		echo "Error: RPC URL for network '$(NETWORK)' is not set in .env"; \
		exit 1; \
	fi
	@echo ">>> Simulating approve-strategy on $(NETWORK) (no broadcast)..."; \
	forge script $(APPROVE_SCRIPT) \
		--rpc-url $(RPC_URL) \
		--private-key $(PRIVATE_KEY_DEPLOYER) \
		--gas-price 50000000000 \
		-vvvv

.PHONY: grant-roles sim-grant-roles approve-strategy sim-approve-strategy
