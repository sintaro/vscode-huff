const vscode = require("vscode");
const commandExists = require("command-exists");
const fs = require("fs");
const {execSync} = require("child_process");


/**Deploy Contract
 * 
 * Deploy the provided contract bytecode to hevm
 * 
 * @param {String} bytecode 
 * @param {Object} config 
 * @param {String} cwd 
 * @param {boolean} macro 
 * @returns 
 */
function deployContract(
    bytecode, 
    config, 
    cwd, 
    macro = false
  ) {
    if (config.stateChecked || config.storageChecked){
        checkStateRepoExistence(config.statePath, cwd)
    }

    const command = `hevm exec
    --code ${bytecode} \
    --address ${config.hevmContractAddress} \
    --create \
    --caller ${config.hevmCaller} \
    --gas 0xffffffff \
    ${(config.stateChecked || config.storageChecked)  ? "--state " + cwd + "/" + config.statePath : ""}
    `
    // cache command
    writeHevmCommand(command, config.tempHevmCommandFilename, cwd);
    
    // execute command
    return execSync("`cat " + cwd + "/" + config.tempHevmCommandFilename + "`");
}


/**Run in User Terminal
 * 
 * Execute a given command within a new terminal
 * 
 * @param {String} command 
 */
function runInUserTerminal(command){
    const terminal = vscode.window.createTerminal({name: "Huff debug"});
    terminal.sendText(command);
    terminal.show();
  }


function writeHevmCommand(command, file, cwd){
    
    try { !fs.accessSync(`${cwd}/cache`) }
    catch (e) {fs.mkdirSync(`${cwd}/cache`) }
    fs.writeFileSync(`${cwd}/${file}`, command);
}


function purgeCache(cwd){
    try { fs.rmSync(`${cwd}/cache`, {recursive:true}) }
    catch (e){console.log("Cache didn't exist")};
}

function checkStateRepoExistence(statePath, cwd) {
    resetStateRepo(statePath, cwd)
}

/**Reset state repo
 * 
 * Hevm state is stored within a local git repository, to reset the state 
 * we must delete the repository then init a new one.
 * 
 * TODO: Windows compatibility
 * @param statePath 
 */
 function resetStateRepo(statePath, cwd) {
    console.log("Creating state repository...")
    
    const fullPath = cwd + "/" + statePath;
    
    // delete old state
    try{ fs.rmSync(fullPath, {recursive:true}) } 
    catch (e){console.log("Cache didn't exist")};

    // check if a cache folder exists
    try { !fs.accessSync(`${cwd}/cache`) }
    catch (e) {fs.mkdirSync(`${cwd}/cache`) }
    fs.mkdirSync(fullPath);

    
    const initStateRepositoryCommand = `git init && git commit --allow-empty -m "init"`;
    execSync(initStateRepositoryCommand, {cwd: fullPath})
    console.log("Created state repository...")
  }
  

  /**Compile
 * 
 * @param {String} sourceDirectory The location in which the users workspace is - where the child processes should be executed
 * @param {String} fileName 
 * @returns 
 */
function compile(sourceDirectory, fileName) {
    console.log("Compiling contract...")

    // having issues with the function level debugger
    const command = `huffc ${fileName} --bytecode`
    const bytecode = execSync(command, {cwd: sourceDirectory});
    return `0x${bytecode.toString()}`;
}


/**Compile From File
 * 
 * Write `source` to a file then compile it with the 
 * installed huffc compiler 
 * 
 * @param {String} source 
 * @param {String} filename 
 * @param {String} cwd 
 * @returns 
 */
function compileFromFile(source, filename, cwd) {
    writeHevmCommand(source, filename, cwd);
    const command = `huffc ${filename} --bytecode`
    const bytecode = execSync(command, {cwd: cwd});
    
    // remove temp file
    fs.rmSync(`${cwd}/${filename}`); 
    return `0x${bytecode.toString()}`;
}

/**Write source to temp file
 * 
 * @param {String} source 
 * @param {String} filename 
 * @param {String} cwd 
 */
function createTempFile(source, filename, cwd){
    fs.writeFileSync(`${cwd}/${filename}`, source);
}


/**Write Macro
 * 
 * Write macro into a temporary file location so that it 
 * can be compiled using huffc
 * 
 * @param {String} cwd 
 * @param {String} tempMacroFilename 
 * @param {String} macro 
 */ 
function writeMacro(cwd, tempMacroFilename, macro) {
    fs.writeFileSync(`${cwd}/${tempMacroFilename}.huff`, macro);
}
  

/**Check Hevm Installation
 * 
 * Uses command-exists package to check for hevm installation
 * throw error if not found
 */
async function checkHevmInstallation() {
    try{
        await commandExists("hevm");
        return true;
    } catch (e){ 
        registerError(
            e,
            "Hevm installation required - install here: https://github.com/dapphub/dapptools#installation"
        )       
        return false;
    }
}

/**Check huff installation
 * 
 * Uses command-exists package to check for huffc installation
 * This is required until web assembly version is created
 * @returns 
 */
async function checkHuffcInstallation() {
    try{
        await commandExists("huffc");
        return true;
    } catch (e){ 
        registerError(
            e,
            "Huffc compiler installation required - install here: https://github.com/huff-language/huff-rs"
        )       
        return false;
    }
}

/**Check Installations
 * 
 * Check for both hevm and huffc installations
 * @returns {Promise<Boolean>} 
 */
async function checkInstallations(){
    const results = await Promise.all([
        checkHevmInstallation(),
        checkHuffcInstallation
    ]);
    return results.every(result => result);
}

/**Register Error
 * 
 * Log an error and display it to the user
 * 
 * @param {Exception} e 
 * @param {String} message 
 */
async function registerError(e, message) {
    vscode.window.showErrorMessage(`${message}\nError Message:\n${e}`);
    console.error(e);
}

/**Format even bytes
 * Format a hex literal to make its length even
 * @param {String} bytes
 */
const formatEvenBytes = (bytes) => {
	if (bytes.length % 2) {
	  return bytes.replace("0x", "0x0");
	}
	return bytes;
};


module.exports = {
    deployContract,
    runInUserTerminal,
    compile,
    writeMacro,
    writeHevmCommand,
    resetStateRepo,
    checkStateRepoExistence,
    registerError,
    compileFromFile,
    checkInstallations,
    purgeCache,
    formatEvenBytes
}