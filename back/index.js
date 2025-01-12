const express = require("express");
const { NodeSSH } = require("node-ssh");
const fs = require("fs");
const cors = require("cors");
const { error } = require("console");

const app = express();
app.use(express.json());

app.use(cors());

const readServers = () => {
  return fs
    .readFileSync("servers.txt", "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const [name, ip, username, port] = line.split(":");
      return { name, ip, username, port };
    });
};

const writeServers = (servers) => {
  const data = servers
    .map(
      (server) =>
        `${server.name}:${server.ip}:${server.username}:${server.port}`
    )
    .join("\n");
  fs.writeFileSync("servers.txt", data);
};

const getGroupsWithHighGID = async (ssh) => {
  const groupsResult = await ssh.execCommand(
    "grep -E ':[0-9]{4,}:' /etc/group"
  );
  return groupsResult.stdout.split("\n").filter((group) => group.trim() !== "");
};

const getGroupsWithUsers = async (ssh) => {
  const groupsResult = await ssh.execCommand("awk -F: '$4 != \"\"' /etc/group");
  return groupsResult.stdout.split("\n").filter((group) => group.trim() !== "");
};

const mergeAndRemoveDuplicates = (groups1, groups2) => {
  const uniqueGroups = new Set([...groups1, ...groups2]);
  return Array.from(uniqueGroups);
};

// ENDPOINTS SERVEURS
// Endpoint pour récupérer la liste des serveurs
app.get("/api/servers", (req, res) => {
  const servers = readServers();
  res.json(servers);
});

// Endpoint pour ajouter un serveur
app.post("/api/add-server", (req, res) => {
  const { ip, name, admin, port } = req.body;
  const newServer = `${name}:${ip}:${admin}:${port}`;

  fs.appendFileSync("servers.txt", `\n${newServer}`); // Ajouter le serveur au fichier
  res.json({ name, ip, admin, port }); // Retourner le serveur ajouté
});

app.delete("/api/delete-server/:ip", (req, res) => {
  const ip = req.params.ip;
  const servers = readServers();

  const updatedServers = servers.filter((server) => server.ip !== ip);

  writeServers(updatedServers);

  res
    .status(200)
    .json({ success: true, message: "Serveur supprimé avec succès." });
});

app.put("/api/update-server/:ip", (req, res) => {
  const oldIp = req.params.ip;
  const { name, newIp, username, port } = req.body;
  const servers = readServers();

  const updatedServers = servers.map((server) => {
    if (server.ip === oldIp) {
      return { name, ip: newIp, username, port };
    }
    return server;
  });

  writeServers(updatedServers);

  res
    .status(200)
    .json({ success: true, message: "Serveur mis à jour avec succès" });
});

// ENDPOINTS USERS
// Endpoint pour récupérer la liste des utilisateurs et des groupes d'un serveur
app.post("/api/users", async (req, res) => {
  const { ip, username, password, port } = req.body;

  const ssh = new NodeSSH();
  try {
    await ssh.connect({ host: ip, port, username, password });

    // Récupérer les utilisateurs
    const result = await ssh.execCommand(
      "grep -E ':[0-9]{4,}:' /etc/passwd | grep -E ':/home/'"
    );

    const users = result.stdout
      .split("\n")
      .filter((user) => user.trim() !== "");

    // Récupérer les groupes
    const groupsWithHighGID = await getGroupsWithHighGID(ssh);
    const groupsWithUsers = await getGroupsWithUsers(ssh);

    const mergedGroups = mergeAndRemoveDuplicates(
      groupsWithHighGID,
      groupsWithUsers
    );

    res.json({ users, groups: mergedGroups });
  } catch (error) {
    res.status(500).json({ error: "Erreur de connexion SSH" });
  } finally {
    ssh.dispose();
  }
});

// Endpoint pour ajouter un utilisateur
app.post("/api/add-user", async (req, res) => {
  const { ip, port, username, password, newUser, newPassword } = req.body;

  if (!ip || !username || !password || !newUser || !newPassword) {
    return res.status(400).json({ error: "Tous les champs sont obligatoires" });
  }

  const ssh = new NodeSSH();
  try {
    await ssh.connect({ host: ip, port, username, password });
    const result = await ssh.execCommand(
      `echo '${password}' | sudo -S useradd -m -s /bin/bash ${newUser} && echo "${newUser}:${newPassword}" | sudo -S chpasswd`
    );

    const result2 = await ssh.execCommand(
      `echo '${password}' | sudo -S usermod -aG sudo,users ${newUser}`
    );

    if ((result.code === 0) & (result2.code === 0)) {
      res
        .status(200)
        .json({ success: true, message: "Utilisateur ajouté avec succès." });
    } else {
      // La commande a échoué
      throw new Error(result.stderr);
    }
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de l'ajout de l'utilisateur" });
  } finally {
    ssh.dispose();
  }
});

// Endpoint pour supprimer un utilisateur
app.post("/api/delete-user", async (req, res) => {
  const { ip, username, password, port, userToDelete } = req.body;

  const ssh = new NodeSSH();
  try {
    await ssh.connect({ host: ip, port, username, password });

    const command = `echo '${password}' | sudo -S userdel -r ${userToDelete}`;
    const result = await ssh.execCommand(command);

    // Vérifier si la commande a réussi
    if (result.code === 0) {
      res
        .status(200)
        .json({ success: true, message: "Utilisateur supprimé avec succès." });
    } else {
      // La commande a échoué
      throw new Error(result.stderr);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    ssh.dispose();
  }
});

app.post("/api/update-user", async (req, res) => {
  const {
    ip,
    port,
    username,
    password,
    userToUpdate,
    newUsername,
    newPassword,
  } = req.body;

  const ssh = new NodeSSH();
  try {
    await ssh.connect({ host: ip, port, username, password });

    if (newUsername && newUsername !== userToUpdate) {
      const renameResult = await ssh.execCommand(
        `echo '${password}' | sudo -S usermod -l ${newUsername} ${userToUpdate}`
      );
      if (renameResult.code !== 0) {
        throw new Error(renameResult.stderr);
      }
    }

    if (newPassword) {
      const passwordResult = await ssh.execCommand(
        `echo '${password}' | sudo -S chpasswd <<< "${
          newUsername || userToUpdate
        }:${newPassword}"`
      );
      if (passwordResult.code !== 0) {
        throw new Error(passwordResult.stderr);
      }
    }

    res
      .status(200)
      .json({ success: true, message: "Utilisateur modifié avec succès." });
  } catch (error) {
    console.error("Erreur lors de la modification de l'utilisateur : ", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la modification de l'utilisateur" });
  } finally {
    ssh.dispose();
  }
});

app.post("/api/toggle-sudo", async (req, res) => {
  const { ip, port, username, password, userToToggle } = req.body;

  if (!ip || !port || !username || !password || !userToToggle) {
    return res.status(400).json({ error: "Tous les champs sont obligatoires" });
  }

  const ssh = new NodeSSH();
  try {
    await ssh.connect({ host: ip, port, username, password });

    // Vérifier si l'utilisateur est déjà dans le groupe sudo
    const checkSudoCommand = `grep '^sudo:' /etc/group`;
    const checkSudoResult = await ssh.execCommand(checkSudoCommand);

    if (checkSudoResult.code !== 0) {
      throw new Error("Erreur lors de la vérification des droits sudo.");
    }

    const isSudo = checkSudoResult.stdout.includes(userToToggle);

    // Ajouter ou retirer l'utilisateur du groupe sudo
    const toggleSudoCommand = isSudo
      ? `echo '${password}' | sudo -S deluser ${userToToggle} sudo` // Retirer sudo
      : `echo '${password}' | sudo -S usermod -aG sudo ${userToToggle}`; // Ajouter sudo

    const toggleSudoResult = await ssh.execCommand(toggleSudoCommand);

    if (toggleSudoResult.code === 0) {
      res.status(200).json({
        success: true,
        message: `Droits sudo ${
          isSudo ? "retirés" : "ajoutés"
        } pour l'utilisateur ${userToToggle}.`,
      });
    } else {
      throw new Error(toggleSudoResult.stderr);
    }
  } catch (error) {
    console.error("Erreur lors de la modification des droits sudo :", error);
    res.status(500).json({
      error: "Erreur lors de la modification des droits sudo.",
    });
  } finally {
    ssh.dispose();
  }
});

app.listen(3000, () => console.log("Serveur en écoute sur le port 3000"));
