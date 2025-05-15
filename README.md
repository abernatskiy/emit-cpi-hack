# emit_cpi!() event decoding

## Context

There are two sorts of event logs in Solana:

1. Regular execution logs: these are just plain text strings with some conventions. They can get truncated, so in most cases they can't be relied upon.
2. [emit_cpi!()](https://www.anchor-lang.com/docs/features/events#emit_cpi) logs that are no-op instructions that contain event data as arguments. These are reliable and suitable for use in ways mirroring EVM event logs.

Here I describe a simple hack that I used to decode the `emit_cpi()` event shown as inner instruction #3.4 of [this transaction](https://solscan.io/tx/3NuGn5afo64xwc6s86LwzoKNLEmpoZNZPvuvt4MGMNvFmEsb83h9gAryx62ZbZ4GjxKtUwuKsWiiZ6ZytnULebtR).

## To run

```bash
git clone https://github.com/abernatskiy/emit-cpi-hack
cd emit-cpi-hack
npm ci
docker compose up -d
npx squid-typeorm-migration apply
npm run build
node -r dotenv/config lib/main.js
```
The output should contain the decoded and raw versions of the event near the bottom:
```
...
{
  accounts: {
    whoKnowsWhatThisAccountIsButItsInTheExplorerSoGuessIllAddIt: 'Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1'
  },
  data: {
    padding0: 17177263679997991869n,
    padding1: 9951897102117436775n,
    mint: 'FbxEm1WcM5sD2DEwdC3EDsVxfytZFGDGQhn9ybEMQLuM',
    solAmount: 68047337278n,
    tokenAmount: 4177289391945262081n,
    isBuy: true,
    user: 'DgN5v9i1SPiQabHereYvxcThNqjuQfkVYYCJ1AZCvVXD',
    timestamp: 74018166880n,
    virtualSolReserves: 434893235035100n,
    virtualTokenReserves: 44018166880n
  }
}
Instruction {
  id: '000293112444-6uVYq-002078-000002-000003',
  transactionIndex: 2078,
  instructionAddress: [ 2, 3 ],
  programId: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
  accounts: [ 'Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1' ],
  data: '2K7nL28PxCW8ejnyCeuMpbWfkY9zzQzZfg1cN5FgJmeAiGaSsXdEbhbKNs5fwho67ebDSGPf5Pf96LoYqKXnHun5qorNeBeu74AMeK6Q6PLPBAzNWSwq5nJhzRdDAAC2DemxkPXoz78hb6TpxPEmjX3oAWGXAawmwSQTkuSm5JX7U5q5cGSfJwmqtVaX',
...
```

## How it came to be

The `emit_cpi()` event is an instruction, so I expected it to be listed in the IDL under `.instructions`. Unfortunately I wasn't able to find an IDL listing it.

However, there was an [IDL](https://github.com/mo4islona/jellyfishes/blob/main/streams/solana_pumpfun_tokens/pumpfun.idl.json) that listed an event with a signature identical to what I was seeing in the explorer. I used its fields list to put together a following instruction entry for the IDL:
```json
    {
      "name": "tradeEventInstruction",
      "docs": [
        "Placeholder docs."
      ],
      "accounts": [],
      "args": [
        {
          "name": "mint",
          "type": "publicKey"
        },
        {
          "name": "solAmount",
          "type": "u64"
        },
        {
          "name": "tokenAmount",
          "type": "u64"
        },
        {
          "name": "isBuy",
          "type": "bool"
        },
        {
          "name": "user",
          "type": "publicKey"
        },
        {
          "name": "timestamp",
          "type": "i64"
        },
        {
          "name": "virtualSolReserves",
          "type": "u64"
        },
        {
          "name": "virtualTokenReserves",
          "type": "u64"
        }
      ]
    },
```
This generated a wrong d8 descriminator so I had to comment out the discriminator-checking call in the decoder JS function. The values came out to be wrong, but I noticed that the `virtualTokenReserves` field has the correct value of `timestamp`. So I padded the argument list. I also added an account because the explorer listed one.
```json
    {
      "name": "tradeEventInstruction",
      "docs": [
        "Placeholder docs."
      ],
      "accounts": [
        {
          "name": "whoKnowsWhatThisAccountIsButItsInTheExplorerSoGuessIllAddIt",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "padding0",
          "type": "u64"
        },
        {
          "name": "padding1",
          "type": "u64"
        },
        {
          "name": "mint",
          "type": "publicKey"
        },
```
This decoded the values correctly, but still generated the wrong d8. Adding a discriminator manually had no effect. Knowing that d8 is a signature hash of some kind I tried looking at the [emit_cpi!() source code](https://github.com/solana-foundation/anchor/blob/0e5285aecdf410fa0779b7cd09a47f235882c156/lang/attribute/event/src/lib.rs#L157C1-L195C2) to figure out what actual type(s) the first argument(s) have, but to no avail. I ended up just recommending the user to replace the d8 value with `0xe445a52e51cb9a1d` in the generated TS code:
```ts
...
/**
 * Placeholder docs.
 */
export const tradeEventInstruction = instruction(
    {
        d8: '0xe445a52e51cb9a1d',
    },
...
```

## Suggestion

It's easy enough to just add decoding of emit_cpi() events to the typegen, but the user-friendly approach should perhaps go further and make such events first class citizens in the API. This can be done without changing the dataset, just by adding the `"events"` data request, with retrieval of parent instructions, transactions etc.
