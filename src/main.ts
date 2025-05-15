import {run} from '@subsquid/batch-processor'
import {augmentBlock} from '@subsquid/solana-objects'
import {DataSourceBuilder, SolanaRpcClient} from '@subsquid/solana-stream'
import {TypeormDatabase} from '@subsquid/typeorm-store'
import * as pumpfun from './abi/pumpfun'

const dataSource = new DataSourceBuilder()
    .setGateway('https://v2.archive.subsquid.io/network/solana-mainnet')
    .setBlockRange({from: 293112444, to: 293112444})
    .setFields({
        block: { // block header fields
            timestamp: true,
            slot: true
        },
        transaction: { // transaction fields
            signatures: true
        },
        instruction: { // instruction fields
            programId: true,
            accounts: true,
            data: true
        },
        tokenBalance: { // token balance record fields
            preAmount: true,
            postAmount: true,
            preOwner: true,
            postOwner: true
        }
    })
    .addInstruction({
        where: {
            programId: ['6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P']
        },
        include: {
            innerInstructions: true, // inner instructions
            transaction: true, // transaction, that executed the given instruction
            transactionTokenBalances: true, // all token balance records of executed transaction
        }
    }).build()

const database = new TypeormDatabase()

run(dataSource, database, async ctx => {
    let blocks = ctx.blocks.map(augmentBlock)

    for (let block of blocks) {
        for (let ins of block.instructions) {
            const signatures = ins.getTransaction().signatures
            if (signatures[0] === '3NuGn5afo64xwc6s86LwzoKNLEmpoZNZPvuvt4MGMNvFmEsb83h9gAryx62ZbZ4GjxKtUwuKsWiiZ6ZytnULebtR' &&
                ins.programId === '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P') {
                
                //if (pumpfun.instructions.tradeEventInstruction.d8 === ins.d8) {
                if (ins.d8 === '0xe445a52e51cb9a1d') {
                    const decoded = pumpfun.instructions.tradeEventInstruction.decode(ins)
                    console.log(decoded)
                }

                console.log(ins, signatures, '\n\n')
            }
        }
    }
})
