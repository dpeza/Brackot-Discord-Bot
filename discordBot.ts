import firebase from 'firebase'
import games from '../../const/GameAssets'


const Discord = require('discord.io');
const logger = require('winston');
const auth = require('./auth.json');


// Configure logger settings
const db = firebase.firestore()
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';
// Initialize Discord Bot
const bot = new Discord.Client({
    token: auth.token,
    autorun: true
});

bot.on('ready', function (evt: any) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
});
//checks if bot is ready 
bot.on('message', async (user: string, userID: string, channelID: string, message: any, evt: string) => {
    // bot gets ready to start 
    //event listener for a message
    // if the message starts with a ! then it will proceed with the switch
    //channel ID needs to be used better 
    //dont know what evt is got this function header online 
    if (message.substring(0, 1) == '!') {
        let args = message.substring(1).split(' ');
        const cmd = args[0];
        let botMessage: any = "";
        args = args.splice(1);
        switch(cmd) {
            //if the user starts a message with ! it checks to see if it fits a command through a swtich
            case 'myTournaments':
                botMessage = getUserNextTournament(userID);
                //switches the message to a string containing tournaments data
                break;
            case 'help':
                botMessage = "List of commands: \n !myTournaments \n !games \n "
                //switches the message to a help message with a list of commands
                break;
            case 'games':
                //switches the message to a list of games supported by brackot
                break;
            case 'myTeam':
                botMessage = getTeamInfo(user);
                //switches the message to a string containing data from the users team
                break
            case 'getTournaments':
                botMessage = getUserHostedTournaments(String(args[0])) 
                break
            case 'joinTournament':
                botMessage = signUpForTournament(args[1], userID, args[0])
        }
        if(!(botMessage === "")) {
            bot.sendMessage({
                to: userID,
                message: botMessage
            })
        }
    }
});
interface TournamentData {
    'name': string,
    'date' : string
    //an interface to help with typing
}

const getUserNextTournament = (userID: String): String => {
    const userTournaments: TournamentData[] = [];
    //an empty array with strong tyoe TournamentData 
    let output: String = ""
    db.collection('tournaments')
    .where("players", "array-contains", `${userID}`).orderBy("date", "desc").get().then(snap => {
        snap.forEach((doc: any) => {
        //gets all tournaments with the player' uid in the players field orders them by date then iterates through 
        const {date, name} = doc.data();
        if(date<4) {
            //needs to be updated to compare todays date with the date of the tournament containing the users data
            const tournament: TournamentData = {'name':name, "date":date};
            userTournaments.push(tournament);
        }
        });
    });
    if(!userTournaments) {
        //if there are no tournaments !userTournaments will return true 
        output = "You have no upcoming tournaments";
    } else {
        output += `You have ${userTournaments.length} tournaments scheduled:`;
        userTournaments.forEach((item) => {
            const{date, name} = item;
            output += `${name} on ${date}`;
            //interpolating all of the tournaments together
        })
    }
    return output
}
const getTeamInfo = async (userID: String): Promise<String> => {
    let output = ""; 
    //team for storing data to be interpolated later
    await db.collection('tournaments').where("members", "array-contains", `${userID}`).get().then((snap: any) => {
        snap.forEach((doc: any) => {
            const{name, tournamentsCreated, tournamentsJoined} = doc.data()
            output = `You are in team ${name}. Your team has participated in ${tournamentsCreated + tournamentsJoined} tournaments`
        })
    })
    return output
    //interpolates team data into final message
    
}
const getUserHostedTournaments = async (name: String): Promise<String> => {
    let output: String = "";
    let counter: number = 0;
    let userID: String = "";
    await db.collection('users').where("userName", "==", `${name}`).get().then((snap: any) => {
        snap.forEach((doc: any) => {
            const{name} = doc.data();
            userID = name;
        })
    })
    await db.collection("tournaments").where("creator", "==", `${userID}`).get().then((snap) => {
        snap.forEach((doc) => {
            const{name, date} = doc.data();
            counter += 1;
            output = `${output} ${counter}. ${name} on ${date} \n`;
        })
    });
    return output;
}
const signUpForTournament = async (number: number, discordID: String, hostName: String): Promise<String> => {
    let userID: String = "";
    let hostID: String = "";
    //an interface that comes with the firebase package
    let tournaments: any=[];
    await db.collection("users").where('discordId', "==", `${discordID}`).get().then(snap=>{
        snap.forEach((doc: any)=>{
            //getting the users userID from their discord id mentioned in the message
            const{Id}= doc.data();
            userID = Id;
        })
    })
    await db.collection('users').where("userName", "==", `${hostName}`).get().then((snap: any) => {
        snap.forEach((doc: any)=> {
            //getting the creators uid from their name
            const{id} = doc.data();
            hostID = id;
        })
    })
    await db.collection("tournaments").where("creator", "==", `${hostID}`).get().then((snap) => {
        snap.forEach((doc: any) => {
            //getting all the tournemants that the creator listed in the message params made
            tournaments.push(doc.data())
        })
    });
    return db.collection("tournaments")
    .doc(tournaments[number-1].Id)
    .update({
        //adding the users UID to the tournaments players list 
        players: firebase.firestore.FieldValue.arrayUnion(userID)
    }).then(() => {
        //messages to let the user know it went successfully or poorly
        return `You have sucessfully joined ${tournaments[number-1]}`
    }).catch(()=>{
        return `Failure to join ${tournaments[number-1]}`
    })
}