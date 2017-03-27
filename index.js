const chalk = require('chalk');
const clear = require('clear');
const CLI = require('clui');
const figlet = require('figlet');
const inquirer = require('inquirer');
const Preferences = require('preferences');
const Spinner = CLI.Spinner;
const GithubApi = require('github');
const _ = require('lodash');
const git = require('simple-git')();
const touch = require('touch');
const fs = require ('fs');
const files = require('./lib/files.js');

clear();
console.log(
  chalk.yellow(
    figlet.textSync('Ginit',{ horizontalLayout: 'full' })
  )
);

if (files.directoryExists('.git')) {
  console.log(chalk.red('Already a git repository!'));
  process.exit();
}

function getGithubCredentials(callback) {
  var questions = [
    {
      name: 'username',
      type: 'input',
      message: 'Enter your Github username or email address: ',
      validate: (value) => {
        if (value.length) {
          return true;
        } else {
          return 'Please enter your username or email address';
        }
      }
    },
    {
      name:'password',
      type:'password',
      message: 'Enter your password',
      validate: (value) => {
        if (value.length) {
          return true;
        } else {
          return 'Please enter your password';
        }
      }
    }
  ];
  inquirer.prompt(questions).then(callback);
}

getGithubCredentials( (args) => {
  console.log(args);
} );


const github = new GithubApi({
  version: '3.0.0'
});

function getGithubToken(callback) {
  let prefs = new Preferences('ginit');

  if (prefs.github && prefs.github.token) {
    return callback(null,prefs.github.token);
  }
}

  //Fetch token
  getGithubCredentials((credentials) => {
    const status = new Spinner('Authenticating you, please wait...');
    status.start();

    github.authenticate(
      _.extend(
        {
          type:'basic'
        },
        credentials
      )
    );

    github.authorization.create({
      scopes: ['user','public_repo','repo','repo:status'],
      note: 'ginit, the command-line tool for initializing Git repos'
    }, (err,res) => {
      status.stop();
        if (err) {
          return callback(err);
        }
        if (res.token) {
          prefs.github = {
            token: res.token
          };
          return callback(null, res.token);
        }
        return callback();
    });
  });

  function createRepo(callback) {
  const minimist = require ('minimist')(process.argv.slice(2));
  const questions = [
    {
      type:'input',
      name:'name',
      message:'Enter a name for the repository:',
        default: argv._[0] || files.getCurrentDirectoryBase(),
      validate: (value) => {
        if (value.length) {
          return true;
        } else {
          return 'Please Enter a name for the repository';
        }
      }
    },
    {
      type:'input',
      name:'description',
      default:argv._[1] || null,
      message:'Optioanally enter a description of the repository'
    },
    {
      type:'list',
      name:'visibility',
      message:'Public or private: ',
      choices:['public','private'],
      default:'public'
    }
  ];

  inquirer.prompt(questions).then( (answers) => {
    const status = new Spinner('Creating repository...');
    status.start();

    const data = {
      name: answers.name,
      description: answers.description,
      private: (answers.visibility === 'private')
    };

    github.repos.create(
      data,
      (err,res) => {
        status.stop();
        if (err) {
          return callback(err);
        }
        return callback(null,res.ssh_url);
      }
    );
  });
  }

  function createGitignore(callback) {
    const filelist = _.without(fs.readdirSync)
  }
