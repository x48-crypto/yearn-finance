import React, { useState, useEffect } from 'react';
import { TextField, Typography, InputAdornment, Button, CircularProgress, Tooltip } from '@material-ui/core';
import Autocomplete from '@material-ui/lab/Autocomplete';
import BigNumber from 'bignumber.js';
import Skeleton from '@material-ui/lab/Skeleton';
import { formatCurrency } from '../../utils';
import GasSpeed from '../gasSpeed';
import classes from './vaultActionCard.module.css';

import stores from '../../stores';
import {
  ERROR,
  DEPOSIT_VAULT,
  DEPOSIT_VAULT_ZAPPER,
  DEPOSIT_VAULT_RETURNED,
  APPROVE_VAULT,
  APPROVE_VAULT_RETURNED,
  CONNECT_WALLET,
  UPDATE_DEPOSIT_STATUS,
  VAULTS_UPDATED,
} from '../../stores/constants';
import Simulation from '../simulation/simulation';

export default function Deposit({ vault }) {
  const [depositStatus, setDepositStatus] = useState('');
  const storeAccount = stores.accountStore.getStore('account');
  const [selectedZapBalanceToken, setSelectedZapBalanceToken] = useState();
  const [account, setAccount] = useState(storeAccount);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState(false);
  const [gasSpeed, setGasSpeed] = useState('');
  const [zapperVaults, setZapperVaults] = useState([]);
  const [zapperBalanceTokens, setZapperBalanceTokens] = useState([]);
  const [currentToken, setCurrentToken] = useState();
  const [hasVaultToken, setHasVaultToken] = useState(true);
  const [zapperBalanceUpdated, setZapperBalanceUpdated] = useState(false);
  const setAmountPercent = (percent) => {
    setAmountError(false);

    setAmount(BigNumber(currentToken.balance).times(percent).div(100).toFixed(currentToken.decimals, BigNumber.ROUND_DOWN));
  };

  const onAmountChanged = (event) => {
    setAmountError(false);
    setAmount(event.target.value);
  };

  const onDeposit = () => {
    if (currentToken.address.toLowerCase() === vault.tokenMetadata.address.toLowerCase()) {
      console.log('same token');
    } else {
      console.log('different token');
    }
    setAmountError(false);
    if (!amount || isNaN(amount) || amount <= 0 || BigNumber(amount).gt(currentToken.balance)) {
      setAmountError(true);
      return false;
    }

    setLoading(true);
    if (currentToken.address.toLowerCase() === vault.tokenMetadata.address.toLowerCase()) {
      stores.dispatcher.dispatch({
        type: DEPOSIT_VAULT,
        content: { vault: vault, amount: amount, gasSpeed: gasSpeed },
      });
    }
    {
      stores.dispatcher.dispatch({
        type: DEPOSIT_VAULT_ZAPPER,
        content: { vault: vault, amount: amount, gasSpeed: gasSpeed, currentToken: currentToken },
      });
    }
  };

  const onApprove = () => {
    if (!amount || isNaN(amount) || amount <= 0 || BigNumber(amount).gt(currentToken.balance)) {
      setAmountError(true);
      return false;
    }

    setLoading(true);
    stores.dispatcher.dispatch({
      type: APPROVE_VAULT,
      content: { vault: vault, amount: amount, gasSpeed: gasSpeed },
    });
  };

  const onApproveMax = () => {
    if (!amount || isNaN(amount) || amount <= 0 || BigNumber(amount).gt(currentToken.balance)) {
      setAmountError(true);
      return false;
    }

    setLoading(true);
    stores.dispatcher.dispatch({
      type: APPROVE_VAULT,
      content: { vault: vault, amount: 'max', gasSpeed: gasSpeed },
    });
  };

  const onConnectWallet = () => {
    stores.emitter.emit(CONNECT_WALLET);
  };

  const setSpeed = (speed) => {
    setGasSpeed(speed);
  };

  useEffect(() => {
    const depositReturned = () => {
      setLoading(false);
    };

    const approveReturned = () => {
      setLoading(false);
    };

    const errorReturned = () => {
      setLoading(false);
    };

    const updateDepositStatus = (message) => {
      setDepositStatus(message);
    };

    const vaultsUpdated = (vaults) => {
      if (vault?.address) {
        let currentVault = stores.investStore.getVault(vault.address);
        let zapperBalanceTokensTmp = zapperBalanceTokens;
        if (currentVault?.tokenMetadata?.balance > 0 && zapperBalanceTokensTmp[0]?.address.toLowerCase() != currentVault?.address?.toLowerCase()) {
          zapperBalanceTokensTmp.unshift(currentVault.tokenMetadata);
          setCurrentToken(zapperBalanceTokensTmp[0]);
          setSelectedZapBalanceToken(currentVault.tokenMetadata);
        }
      }
    };

    stores.emitter.on(ERROR, errorReturned);
    stores.emitter.on(DEPOSIT_VAULT_RETURNED, depositReturned);
    stores.emitter.on(APPROVE_VAULT_RETURNED, approveReturned);
    stores.emitter.on(UPDATE_DEPOSIT_STATUS, updateDepositStatus);
    stores.emitter.on(VAULTS_UPDATED, vaultsUpdated);

    return () => {
      stores.emitter.removeListener(ERROR, errorReturned);
      stores.emitter.removeListener(DEPOSIT_VAULT_RETURNED, depositReturned);
      stores.emitter.removeListener(APPROVE_VAULT_RETURNED, approveReturned);
      stores.emitter.removeListener(UPDATE_DEPOSIT_STATUS, updateDepositStatus);
      stores.emitter.removeListener(VAULTS_UPDATED, vaultsUpdated);
    };
  });

  useEffect(() => {
    async function fetchVaultsFromZapper() {
      const response = await fetch('https://api.zapper.fi/v1/vault-stats/yearn?api_key=96e0cc51-a62e-42ca-acee-910ea7d2a241');
      if (response.status === 200) {
        const zapperVaultsJSON = await response.json();
        setZapperVaults(zapperVaultsJSON);
      }
    }
    fetchVaultsFromZapper().then(() => {
      setZapperBalanceUpdated(true);
    });
  }, []);

  useEffect(() => {
    async function fetchAccountBalanceFromZapper() {
      const response = await fetch(`https://api.zapper.fi/v1/balances/tokens?api_key=96e0cc51-a62e-42ca-acee-910ea7d2a241&addresses[]=${account.address}`);
      if (response.status === 200) {
        const tokensJSON = await response.json();
        let tokens = [];
        let tmpHasVaultToken = false;
        vault.tokenMetadata = { ...vault.tokenMetadata, ...{ img: vault.tokenMetadata.icon, label: vault.tokenMetadata.displayName } };
        if (tokensJSON && tokensJSON[account.address]) {
          tokens = tokensJSON[account.address];
          let tmpTokens = [];
          tokens.map((token) => {
            if (token?.address?.toLowerCase() === vault?.tokenMetadata?.address?.toLowerCase()) {
              setHasVaultToken(true);
              tmpHasVaultToken = true;
            } else {
              tmpTokens.push(token);
            }
          });
          if (vault.tokenMetadata.balance > 0) {
            tmpTokens.unshift(vault.tokenMetadata);
          }
          setZapperBalanceTokens(tmpTokens);
          if (!tmpHasVaultToken) {
            setHasVaultToken(false);
            if (tmpTokens?.length > 0) {
              setCurrentToken(tmpTokens[0]);
              setSelectedZapBalanceToken(tmpTokens[0]);
            }
            //tokens.unshift(vaultToken);
          }
        }
      }
    }
    fetchAccountBalanceFromZapper();
  }, []);

  useEffect(() => {
    async function fetchTokensFromZapper() {
      const response = await fetch('https://api.zapper.fi/v1/prices?api_key=96e0cc51-a62e-42ca-acee-910ea7d2a241');
      if (response.status === 200) {
        const zapperVaultsJSON = await response.json();
      }
    }
    fetchTokensFromZapper();
  }, []);

  return selectedZapBalanceToken?.address && zapperBalanceUpdated ? (
    <div className={classes.depositContainer}>
      <div className={classes.textField}>
        <div className={classes.inputTitleContainer}>
          <div className={classes.inputTitle}>
            <Typography variant="h5" noWrap>
              Deposit
            </Typography>
          </div>
          <div className={classes.balances}>
            <Typography
              variant="h5"
              onClick={() => {
                setAmountPercent(100);
              }}
              className={classes.value}
              noWrap
            >
              Balance: {!currentToken?.balance ? <Skeleton /> : formatCurrency(currentToken.balance)}
            </Typography>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: '10px' }}>
          <Autocomplete
            options={zapperBalanceTokens}
            value={selectedZapBalanceToken}
            onChange={(event, newValue) => {
              if (newValue?.address) {
                let newCurrentToken = {
                  address: newValue.address,
                  balance: newValue.balance,
                  decimals: newValue.decimals,
                  displayName: newValue.label,
                  img: newValue.icon,
                  price: newValue.price,
                  name: newValue.label,
                  symbol: newValue.symbol,
                  allowance: newValue.allowance,
                };
                setAmount(0);
                setCurrentToken(newCurrentToken);
                setSelectedZapBalanceToken(newValue);
              }
            }}
            getOptionLabel={(option) => option.label}
            style={{ width: '55%', marginRight: '5px' }}
            renderOption={(option, { selected }) => (
              <React.Fragment>
                <img src={option.icon ? option.icon : `https://zapper.fi/images/${option.img}`} alt="" width={30} height={30} style={{ marginRight: '10px' }} />
                <span className={classes.color} style={{ backgroundColor: option.color }} />
                <div className={classes.text}>
                  {option.label}
                  <br />
                </div>
              </React.Fragment>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                InputProps={{
                  ...params.InputProps,
                  ...{
                    startAdornment: (
                      <InputAdornment position="start">
                        <img
                          src={selectedZapBalanceToken?.icon ? selectedZapBalanceToken.icon : `https://zapper.fi/images/${selectedZapBalanceToken.img}`}
                          alt=""
                          width={30}
                          height={30}
                        />
                      </InputAdornment>
                    ),
                  },
                }}
                label="Token"
                variant="outlined"
              />
            )}
          />
          <TextField variant="outlined" style={{ width: '40%' }} placeholder="" value={amount} error={amountError} onChange={onAmountChanged} />
        </div>
      </div>
      <div className={classes.scaleContainer}>
        <Tooltip title="25% of your wallet balance">
          <Button
            className={classes.scale}
            variant="outlined"
            color="primary"
            onClick={() => {
              setAmountPercent(25);
            }}
          >
            <Typography variant={'h5'}>25%</Typography>
          </Button>
        </Tooltip>
        <Tooltip title="50% of your wallet balance">
          <Button
            className={classes.scale}
            variant="outlined"
            color="primary"
            onClick={() => {
              setAmountPercent(50);
            }}
          >
            <Typography variant={'h5'}>50%</Typography>
          </Button>
        </Tooltip>
        <Tooltip title="75% of your wallet balance">
          <Button
            className={classes.scale}
            variant="outlined"
            color="primary"
            onClick={() => {
              setAmountPercent(75);
            }}
          >
            <Typography variant={'h5'}>75%</Typography>
          </Button>
        </Tooltip>
        <Tooltip title="100% of your wallet balance">
          <Button
            className={classes.scale}
            variant="outlined"
            color="primary"
            onClick={() => {
              setAmountPercent(100);
            }}
          >
            <Typography variant={'h5'}>100%</Typography>
          </Button>
        </Tooltip>
      </div>
      <div>
        {amount && amount > 0 && zapperVaults?.length > 0 ? (
          <Simulation tokenAmount={amount} vault={vault} currentToken={currentToken} zapperVaults={zapperVaults} />
        ) : null}
        <GasSpeed setParentSpeed={setSpeed} />
      </div>

      {(!account || !account.address) && (
        <div className={classes.actionButton}>
          <Button fullWidth disableElevation variant="contained" color="primary" size="large" onClick={onConnectWallet} disabled={loading}>
            <Typography variant="h5">Connect Wallet</Typography>
          </Button>
        </div>
      )}
      {account && account.address && (
        <div className={classes.actionButton}>
          {(amount === '' ||
            BigNumber(currentToken.allowance).gte(amount) ||
            currentToken.address.toLowerCase() !== vault.tokenMetadata.address.toLowerCase()) && (
            <Button fullWidth disableElevation variant="contained" color="primary" size="large" onClick={onDeposit} disabled={loading}>
              <Typography variant="h5">
                {loading ? (
                  <>
                    <CircularProgress size={25} />
                    {depositStatus}
                  </>
                ) : (
                  'Deposit'
                )}
              </Typography>
            </Button>
          )}
          {amount !== '' &&
            BigNumber(amount).gt(0) &&
            (!currentToken.allowance || BigNumber(currentToken.allowance).eq(0) || BigNumber(currentToken.allowance).lt(amount)) &&
            currentToken.address.toLowerCase() === vault.tokenMetadata.address.toLowerCase() && (
              <React.Fragment>
                <Button
                  fullWidth
                  disableElevation
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={onApprove}
                  disabled={loading}
                  className={classes.marginRight}
                >
                  <Typography variant="h5">{loading ? <CircularProgress size={25} /> : 'Approve Exact'}</Typography>
                </Button>
                <Button
                  fullWidth
                  disableElevation
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={onApproveMax}
                  disabled={loading}
                  className={classes.marginLeft}
                >
                  <Typography variant="h5">{loading ? <CircularProgress size={25} /> : 'Approve Max'}</Typography>
                </Button>
              </React.Fragment>
            )}
        </div>
      )}
    </div>
  ) : (
    <>
      <p>Looks like you don't have any asset to deposit.</p>
      {vault.tokenMetadata.displayName.toLowerCase().includes('crv') ? (
        <>
          <p>In order to acquire {vault.tokenMetadata.displayName}, you need to either:</p>

          <p>- buy ETH or DAI on your favorite exchange and then zap them here</p>
          <p>or</p>
          <p>
            - Go to{' '}
            <a href={`https://curve.fi/${vault.tokenMetadata.displayName.replace('crv', '').replace('3Crv', '3pool').toLowerCase()}/deposit`}>
              curve.fi/{vault.tokenMetadata.displayName.replace('crv', '').replace('3Crv', '3pool').toLowerCase()}/deposit
            </a>{' '}
            and do a deposit there. You will then receive ${vault.tokenMetadata.displayName} you will be able to deposit here.
          </p>
        </>
      ) : (
        <p>
          In order to acquire {vault.tokenMetadata.displayName}, you need to buy {vault.tokenMetadata.displayName} on your favorite crypto exchange.
        </p>
      )}
    </>
  );
}
